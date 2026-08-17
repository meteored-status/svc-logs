/**
 * Editor: Bixus
 * Fecha: Fri, 07 Aug 2026 08:55:42 GMT
 * Hash: 3d681413f502ff49c3d62e2f2eb533b0
 * Versión: 2026.8.7+2-bixus
 * Proyecto: https://github.com/alpred/meteored-svc-proxy.git
 */

import {Socket} from "node:net";
import type {Duplex} from "node:stream";
import http from "node:http";
import https from "node:https";

import {Deferred} from "services-comun/modules/utiles/promise";
import {warning} from "services-comun/modules/utiles/log";

/** Timeout por defecto (ms) para establecer el túnel con el backend. */
const TIMEOUT_DEFECTO_MS = 10000;

/**
 * Contexto de una petición HTTP/1.1 con cabecera `Upgrade:` (WebSocket, HMR de bundlers,
 * o cualquier otro protocolo negociado sobre HTTP), tal y como la entrega el evento
 * nativo `'upgrade'` de Node, más los datos normalizados que necesita el matching.
 *
 * @property request - Petición entrante. Sus cabeceras deben reenviarse íntegras al backend
 *   (`connection`, `upgrade`, `sec-websocket-*`) o el handshake fallará.
 * @property socket  - Socket del cliente, ya desacoplado del parser HTTP: nadie escribirá
 *   en él salvo el handler que tome posesión.
 * @property head    - Bytes que el cliente envió inmediatamente después de las cabeceras y
 *   que ya estaban en el buffer del parser; pertenecen al flujo tunelizado, no a la petición.
 * @property dominio - Host efectivo, resuelto con el mismo criterio que `RequestContext.dominio`
 *   (respeta `X-Forwarded-Host` si `trustProxy`).
 * @property path    - Path de la petición sin query string.
 * @property https   - `true` si la petición entró por el servidor HTTPS.
 */
export interface IUpgradeContext {
    request: http.IncomingMessage;
    socket: Duplex;
    head: Buffer;
    dominio: string;
    path: string;
    https: boolean;
}

/**
 * Función que atiende un upgrade emparejado. Toma posesión del socket del cliente: debe
 * completar el handshake (o cerrarlo) y resolver cuando el túnel esté establecido. Si
 * rechaza, quien la invocó cierra el socket con un `502`.
 */
export type TUpgradeRunner = (contexto: IUpgradeContext) => Promise<void>;

/**
 * Descriptor de un handler de upgrade, declarado por un `RouteGroup` mediante
 * `getUpgradeHandlers()`.
 *
 * El matching es deliberadamente ligero (host exacto + prefijo de path) y **no** reutiliza
 * los `Checker` del router HTTP: un evento `'upgrade'` no trae `ServerResponse`, por lo que
 * no puede construirse la `Conexion` de la que dependen esos matchers.
 *
 * @property resumen  - Identificador corto de la ruta, usado en logs.
 * @property dominios - Hosts exactos a los que aplica. Vacío o ausente = todos.
 * @property prefix   - Prefijo de path al que se limita. Ausente = cualquier path.
 * @property handler  - Función que atiende o reenvía el upgrade.
 */
export interface IUpgradeHandler {
    resumen: string;
    dominios?: string[];
    prefix?: string;
    handler: TUpgradeRunner;
}

/**
 * Opciones de {@link buildUpgradeContext}.
 *
 * @property https      - `true` si la petición llegó por el servidor HTTPS.
 * @property trustProxy - Si `true`, se confía en `X-Forwarded-Host`/`X-Forwarded-Proto`.
 */
export interface IUpgradeContextConfig {
    https?: boolean;
    trustProxy?: boolean;
}

/**
 * Opciones de {@link proxyUpgrade}.
 *
 * @property host    - Valor de la cabecera `Host` a enviar al backend. Por defecto, el host
 *   de `base`. Los backends que enrutan por dominio necesitan recibir el host original de la
 *   petición, no el del socket destino.
 * @property headers - Cabeceras que se añaden o sobreescriben sobre las de la petición original.
 * @property timeout - Timeout (ms) para establecer el túnel. Por defecto 10000. Una vez
 *   establecido se desactiva, para no cortar conexiones legítimamente inactivas.
 */
export interface IProxyUpgradeConfig {
    host?: string;
    headers?: http.OutgoingHttpHeaders;
    timeout?: number;
}

/**
 * Normaliza los argumentos del evento nativo `'upgrade'` en un {@link IUpgradeContext}.
 *
 * @param request - Petición entrante.
 * @param socket  - Socket del cliente.
 * @param head    - Primer fragmento del flujo tunelizado ya leído por el parser.
 * @param config  - Opciones de resolución de host/esquema ({@link IUpgradeContextConfig}).
 */
export function buildUpgradeContext(request: http.IncomingMessage, socket: Duplex, head: Buffer, {https: seguro = false, trustProxy = false}: IUpgradeContextConfig = {}): IUpgradeContext {
    let dominio = request.headers.host ?? "";
    let esSeguro = seguro;
    if (trustProxy) {
        const xfh = request.headers["x-forwarded-host"];
        if (typeof xfh === "string" && xfh.length > 0) {
            dominio = xfh.split(",")[0]?.trim() ?? "";
        }
        const proto = request.headers["x-forwarded-proto"];
        if (typeof proto === "string" && proto.length > 0) {
            esSeguro = proto.split(",")[0]?.trim().toLowerCase() === "https";
        }
    }

    return {
        request,
        socket,
        head,
        dominio,
        path: new URL(`http://localhost${request.url ?? "/"}`).pathname,
        https: esSeguro,
    };
}

/**
 * Devuelve el primer descriptor cuyo host y prefijo de path coinciden con el contexto,
 * o `undefined` si ninguno lo hace. Mantiene la semántica "primer match gana" del router HTTP.
 *
 * @param handlers - Descriptores declarados por los grupos de rutas, en orden de declaración.
 * @param contexto - Contexto del upgrade entrante.
 */
export function matchUpgradeHandler(handlers: IUpgradeHandler[], contexto: IUpgradeContext): IUpgradeHandler|undefined {
    for (const handler of handlers) {
        if (handler.dominios !== undefined && handler.dominios.length > 0 && !handler.dominios.includes(contexto.dominio)) {
            continue;
        }
        if (handler.prefix !== undefined && !contexto.path.startsWith(handler.prefix)) {
            continue;
        }
        return handler;
    }

    return undefined;
}

/**
 * Registra el listener mínimo de `'error'` sobre el socket del cliente.
 *
 * El evento `'upgrade'` entrega el socket **crudo**: Node ya no tiene ningún listener de
 * error puesto sobre él, así que un `ECONNRESET` del cliente mientras se negocia con el
 * backend se convertiría en un `'error'` sin manejar y derribaría el proceso. Un cierre
 * abrupto del cliente es un evento rutinario (recargar la página corta el socket de HMR),
 * por lo que no se loggea: solo se destruye el socket.
 *
 * Debe invocarse **antes** de cualquier operación asíncrona sobre el socket.
 *
 * @param socket - Socket del cliente recién entregado por el evento `'upgrade'`.
 */
export function protegerSocket(socket: Duplex): void {
    socket.addListener("error", () => {
        socket.destroy();
    });
}

/**
 * Rechaza un upgrade escribiendo una respuesta de estado mínima sobre el socket crudo y
 * cerrándolo. A estas alturas ya no existe `ServerResponse`, así que la línea de estado se
 * serializa a mano.
 *
 * @param socket  - Socket del cliente.
 * @param status  - Código de estado HTTP a devolver.
 * @param mensaje - Texto de la línea de estado (`reason phrase`).
 */
export function abortUpgrade(socket: Duplex, status: number, mensaje: string): void {
    if (socket.destroyed) {
        return;
    }
    if (!socket.writable) {
        socket.destroy();
        return;
    }
    socket.once("finish", () => {
        socket.destroy();
    });
    socket.end(`HTTP/1.1 ${status} ${mensaje}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`);
}

/**
 * Copia el estado y las cabeceras crudas de una respuesta del backend al formato de una
 * respuesta HTTP/1.1 serializada. Se usa `rawHeaders` para preservar el orden, las
 * mayúsculas y las cabeceras repetidas (`sec-websocket-extensions`, `set-cookie`…).
 */
function serializarCabeceras(respuesta: http.IncomingMessage, status: number, mensaje: string): string {
    const lineas: string[] = [`HTTP/1.1 ${status} ${mensaje}`];
    for (let i = 0; i < respuesta.rawHeaders.length; i += 2) {
        lineas.push(`${respuesta.rawHeaders[i]}: ${respuesta.rawHeaders[i + 1]}`);
    }

    return `${lineas.join("\r\n")}\r\n\r\n`;
}

/**
 * Desactiva Nagle y el timeout de inactividad de un socket que va a quedar tunelizado.
 * Un socket de HMR pasa la mayor parte del tiempo inactivo y transporta mensajes muy
 * pequeños, así que ambos ajustes por defecto le perjudican.
 */
function prepararTunel(socket: Duplex): void {
    if (!(socket instanceof Socket)) {
        return;
    }
    socket.setNoDelay(true);
    socket.setTimeout(0);
}

/**
 * Reenvía un upgrade a `base` y, si el backend responde `101`, deja los dos sockets unidos
 * en tubería bidireccional hasta que cualquiera de los dos se cierre.
 *
 * Reenvía las cabeceras de la petición original tal cual (con `Host` reescrito), porque el
 * handshake WebSocket va firmado sobre `sec-websocket-key`. El `head` del cliente se escribe
 * al backend **después** de completar el handshake: son bytes del flujo tunelizado, no de la
 * petición, y enviarlos antes corrompería el protocolo.
 *
 * Si el backend contesta con una respuesta normal en lugar de un `101` (p.ej. `404` porque el
 * frontend todavía no ha arrancado su servidor de HMR), se reenvía ese estado al cliente y la
 * promesa **resuelve**: el upgrade se ha atendido, aunque no se haya establecido el túnel.
 *
 * @param contexto - Contexto del upgrade entrante.
 * @param base     - URL base del backend (`http://127.0.0.1:3000`, `https://test-www.dominio.com`…).
 * @param config   - Opciones de reenvío ({@link IProxyUpgradeConfig}).
 */
export async function proxyUpgrade(contexto: IUpgradeContext, base: string, {host, headers, timeout = TIMEOUT_DEFECTO_MS}: IProxyUpgradeConfig = {}): Promise<void> {
    const destino = new URL(`${base}${contexto.request.url ?? "/"}`);
    const HTTP = destino.protocol === "https:" ? https : http;

    const deferred = new Deferred<void>();
    let establecido = false;

    const peticion = HTTP.request(destino, {
        method: contexto.request.method ?? "GET",
        timeout,
        // Un upgrade se apropia del socket de forma permanente: nunca debe salir de un pool
        // keep-alive, o el agente intentaría reutilizar un socket que ya no habla HTTP.
        agent: false,
        headers: {
            ...contexto.request.headers,
            host: host ?? destino.host,
            ...headers ?? {},
        },
    });

    peticion.addListener("upgrade", (respuesta: http.IncomingMessage, socketBackend: Duplex, headBackend: Buffer) => {
        establecido = true;

        // El socket saliente también queda crudo tras el `'upgrade'`: sus errores ya no los
        // recoge `peticion`. Se registran los listeners antes de cualquier escritura para que
        // ningún fallo quede sin manejar.
        const cerrar = (): void => {
            socketBackend.destroy();
            contexto.socket.destroy();
        };
        socketBackend.addListener("error", cerrar);
        socketBackend.addListener("close", cerrar);

        if (contexto.socket.destroyed || !contexto.socket.writable) {
            cerrar();
            deferred.reject(new Error(`El cliente cerró la conexión antes de completar el upgrade con ${destino.host}`));
            return;
        }

        contexto.socket.addListener("error", cerrar);
        contexto.socket.addListener("close", cerrar);

        contexto.socket.write(serializarCabeceras(respuesta, respuesta.statusCode ?? 101, respuesta.statusMessage ?? "Switching Protocols"));
        if (headBackend.length > 0) {
            contexto.socket.write(headBackend);
        }
        if (contexto.head.length > 0) {
            socketBackend.write(contexto.head);
        }

        prepararTunel(contexto.socket);
        prepararTunel(socketBackend);

        socketBackend.pipe(contexto.socket);
        contexto.socket.pipe(socketBackend);

        deferred.resolve();
    });

    peticion.addListener("response", (respuesta: http.IncomingMessage) => {
        establecido = true;
        // El backend no aceptó el upgrade. Devolvemos su estado real (no un 502 genérico)
        // para que el motivo sea visible en el navegador, y descartamos el cuerpo: las
        // cabeceras de longitud/codificación del backend no aplican a lo que escribimos aquí.
        const status = respuesta.statusCode ?? 502;
        respuesta.resume();
        warning("Upgrade rechazado por el backend", destino.href, status);
        abortUpgrade(contexto.socket, status, respuesta.statusMessage ?? "Bad Gateway");
        deferred.resolve();
    });

    peticion.addListener("timeout", () => {
        if (establecido) {
            return;
        }
        peticion.destroy(new Error(`Timeout (${timeout}ms) estableciendo el upgrade con ${destino.host}`));
    });

    peticion.addListener("error", (err: Error) => {
        deferred.reject(err);
    });

    peticion.end();

    return deferred.promise;
}
