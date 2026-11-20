/**
 * Editor: Bixus
 * Fecha: Wed, 18 Nov 2026 15:20:23 GMT
 * Hash: a11e2d1f4d1608a718cdd45297d9a640
 * Versión: 2026.11.18+1-bixus
 * Anterior: 2026.11.13+1-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

import tracer, {type Span} from "dd-trace";
import {formats} from "dd-trace/ext";
import type {IncomingMessage, Server} from "node:http";
import {type RawData, WebSocketServer, type WebSocket as WS} from "ws";

import {info, warning} from "services-comun/modules/utiles/log";
import {Deferred, PromiseTimeout, PromiseTimeoutError} from "services-comun/modules/utiles/promise";

import type {IMessageClient, IMessageServerKO, IMessageServerOK} from "../../metadata/websocket/message";
import {ESPERA_CIERRE_MS, retrasosApagado, ventanaApagadoMs, vidaConexionMs} from "./escalonado";
import {type IWSHandler, normalizarRuta, WSHandler} from "./handler";

/**
 * Mensajes de control que el servidor envía al cliente fuera del flujo
 * de petición/respuesta para gestionar el ciclo de vida de la conexión.
 * @member Ready    - Enviado al cliente nada más establecer la conexión.
 * @member Alive    - Enviado periódicamente para confirmar que la conexión sigue activa.
 * @member Shutdown - Enviado cuando la conexión supera el tiempo máximo de vida; indica al cliente que debe cerrar.
 */
export const enum EWSControlMessage {
    Ready    = "Ready",
    Alive    = "Alive",
    Shutdown = "Shutdown",
}

/**
 * Representa el estado interno de un cliente WebSocket conectado.
 * @property timestamp - Marca de tiempo (ms desde epoch) en la que se estableció la conexión (no la del último
 *   mensaje recibido): de ella cuenta la vida de la conexión.
 * @property vidaMs - Vida (ms) de esta conexión antes de reciclarla con `Shutdown`: `MAX_LIVENESS_MS` (`escalonado.ts`) menos un
 *   jitter de hasta `LIVENESS_JITTER_MS`, fijado al conectar para que las conexiones abiertas en la misma
 *   ráfaga no se reciclen todas a la vez.
 * @property timer - Referencia al intervalo/timeout de liveness activo para este cliente.
 * @property client - Socket WebSocket asociado al cliente.
 * @property pendingBuffer - Promesa diferida que se resuelve cuando llega el fragmento binario
 *   (ArrayBuffer) esperado tras un mensaje que declaró `buffer: true`.
 * @property traceContext - Span del upgrade HTTP capturado en el momento de la conexión.
 *   Se usa como padre de cada span de mensaje WebSocket cuando el cliente no propaga contexto propio.
 * @property ruta - Ruta (normalizada) a la que hizo el upgrade la conexión, si es una ruta reservada por
 *   handlers con `ruta`. Con ella se eligen los handlers que resuelven sus mensajes; `undefined` = solo los
 *   handlers globales (sin `ruta`). Se fija en la conexión y no se reevalúa por mensaje.
 * @property request - Petición HTTP del upgrade, tal como llegó al handshake.
 * @property activeRequests - Número de handlers actualmente en vuelo para esta conexión.
 *   Se compara con {@link WebSocket.MAX_CONCURRENT_REQUESTS} para limitar la concurrencia
 *   y proteger el servidor frente a inundaciones de peticiones.
 */
interface IClientMap {
    timestamp: number;
    vidaMs: number;
    timer?: NodeJS.Timeout;
    client: WS;
    pendingBuffer?: Deferred<ArrayBuffer|undefined>;
    traceContext: Span | null;
    ruta: string | undefined;
    request: IncomingMessage;
    activeRequests: number;
}

/**
 * Servidor WebSocket singleton que gestiona el ciclo de vida de las conexiones,
 * el protocolo de liveness y el enrutamiento de mensajes hacia los {@link IWSHandler}
 * registrados.
 *
 * ### Ciclo de vida de una conexión
 * 1. Al conectar, el servidor envía un mensaje `"Ready"`.
 * 2. Cada {@link INTERVAL_ALIVE_MS} ms se envía un ping `"Alive"` mientras la
 *    conexión no supere su vida (`MAX_LIVENESS_MS` (`escalonado.ts`) menos un jitter por conexión de hasta
 *    `LIVENESS_JITTER_MS`: entre 420 y 540 s).
 * 3. Cuando se alcanza el límite de tiempo, se notifica al cliente con `"Shutdown"`
 *    y se cierra limpiamente tras {@link MAX_SHUTDOWN_MS}.
 *
 * ### Protocolo de mensajes con buffer binario
 * Un cliente puede enviar primero un mensaje JSON con `buffer: true` y a
 * continuación un frame binario. Ambos se correlacionan antes de invocar al
 * handler correspondiente.
 */
class WebSocket {
    /* STATIC */

    /** Intervalo entre envíos de ping de liveness (ms). */
    private static readonly INTERVAL_ALIVE_MS = 10000;

    /** Tiempo de espera para que el cliente cierre limpiamente tras recibir el shutdown (ms). */
    private static readonly MAX_SHUTDOWN_MS = ESPERA_CIERRE_MS;

    /**
     * Número máximo de handlers simultáneos permitidos por conexión.
     * Si un cliente supera este límite, sus peticiones adicionales se rechazan con
     * un error `ok: false` hasta que algún handler en curso finalice.
     */
    private static readonly MAX_CONCURRENT_REQUESTS = 10;

    /**
     * Tiempo máximo (ms) de ejecución permitido para un handler.
     * Si se supera, el cliente recibe un error inmediato y el slot de concurrencia
     * se libera. El handler continúa ejecutándose en background hasta que su promesa
     * se resuelva o rechace; sus respuestas serán ignoradas por el cliente, que ya
     * recibió el error de timeout.
     */
    private static readonly HANDLER_TIMEOUT_MS = 30000;

    /** Mensaje JSON serializado que se envía al cliente nada más establecer la conexión. */
    private static readonly MESSAGE_CONNECTION = JSON.stringify({
        ok: true,
        buffer: false,
        done: false,
        data: EWSControlMessage.Ready,
    } as IMessageServerOK<string>);

    /** Mensaje JSON serializado que se envía periódicamente para mantener viva la conexión. */
    private static readonly MESSAGE_LIVENESS = JSON.stringify({
        ok: true,
        buffer: false,
        done: false,
        data: EWSControlMessage.Alive,
    } as IMessageServerOK);

    /** Mensaje JSON serializado que notifica al cliente que la conexión va a cerrarse. */
    private static readonly MESSAGE_SHUTDOWN = JSON.stringify({
        ok: false,
        info: {
            message: EWSControlMessage.Shutdown,
        },
    } as IMessageServerKO);

    /* INSTANCE */

    /** Mapa de clientes activos indexado por su socket WebSocket. */
    private clientes: Map<WS, IClientMap>;

    /** Servidor WebSocket de la librería `ws` vinculado al servidor HTTP. */
    private server: WebSocketServer;

    /**
     * Tabla de enrutamiento de handlers indexada por nombre de método.
     * Cuando un {@link IWSHandler} declara varios métodos, cada uno tiene su propia
     * entrada apuntando a la misma instancia del handler.
     * Permite lookup O(1) frente al O(n) de recorrer un array.
     */
    private readonly handlers: Record<string, IWSHandler>;

    /**
     * Tabla de enrutamiento de los handlers que declaran `ruta`, indexada por la ruta normalizada y,
     * dentro de ella, por nombre de método. Una conexión ligada a una ruta solo consulta su entrada
     * (nunca {@link handlers}), y una conexión no ligada nunca consulta esta tabla.
     */
    private readonly handlersRuta: Map<string, Record<string, IWSHandler>>;

    /**
     * Handlers con `autorizar` indexados por ruta normalizada: los que hay que consultar en el handshake.
     * Una ruta sin entrada aquí (pero con handlers) es de acceso libre.
     */
    private readonly autorizadores: Map<string, IWSHandler[]>;

    /** Si es `true`, el servidor está en proceso de shutdown y rechaza nuevas conexiones. */
    private draining: boolean;

    /**
     * Inicializa el servidor WebSocket y registra los listeners de conexión.
     * @param http - Servidor HTTP de Node.js al que se asocia el WebSocket.
     * @param handlers - Lista de handlers que procesan los distintos métodos de mensaje.
     */
    public constructor(protected readonly http: Server, handlers: IWSHandler[]) {
        this.clientes = new Map<WS, IClientMap>();
        this.handlers = {};
        this.handlersRuta = new Map<string, Record<string, IWSHandler>>();
        this.autorizadores = new Map<string, IWSHandler[]>();
        this.draining = false;
        // El rechazo por ruta/token se decide en `verifyClient`, dentro del propio handshake de `ws`: el
        // upgrade lo atiende un único listener (el de `ws`), así que no hay dos que escriban en el mismo
        // socket ni hace falta tocar el listener de `IUpgradeHandler` del servidor HTTP.
        this.server = new WebSocketServer({
            server: http,
            verifyClient: ({req}, cb) => {
                this.verificar(req, cb);
            },
        });
        this.addHandlers(handlers);

        this.server.on('connection', (ws: WS, req: IncomingMessage) => {
            // Rechazar nuevas conexiones durante el shutdown
            if (this.draining) {
                ws.close(1001, "Server shutting down");
                return;
            }

            const cliente = {
                timestamp: Date.now(),
                vidaMs: vidaConexionMs(Math.random),
                traceContext: tracer.scope().active(),
                ruta: this.rutaReservada(req),
                request: req,
                activeRequests: 0,
                timer: setInterval(()=>{
                    if ((Date.now()-cliente.timestamp)<cliente.vidaMs) {
                        cliente.client.send(WebSocket.MESSAGE_LIVENESS);
                    } else {
                        cliente.client.send(WebSocket.MESSAGE_SHUTDOWN);
                        clearInterval(cliente.timer);
                        delete cliente.timer;
                        // Dar tiempo al cliente para cerrar limpiamente
                        cliente.timer = setTimeout(() => {
                            delete cliente.timer;
                            cliente.client.close(1001, "Shutdown");
                        }, WebSocket.MAX_SHUTDOWN_MS).unref();
                    }
                }, WebSocket.INTERVAL_ALIVE_MS).unref(),
                client: ws,
            } as IClientMap;

            this.clientes.set(ws, cliente);

            ws.send(WebSocket.MESSAGE_CONNECTION);

            ws.on('message', (message, isBinary) => {
                if (cliente.pendingBuffer) {
                    if (!isBinary) {
                        // Llegó un mensaje JSON mientras se esperaba el frame binario:
                        // rechazar el deferred huérfano (activa el .finally → activeRequests--)
                        // y procesar el nuevo mensaje normalmente.
                        const deferred = cliente.pendingBuffer;
                        delete cliente.pendingBuffer;
                        deferred.reject(new Error("Expected binary frame, received JSON"));
                        this.handleMessage(ws, cliente, message);
                    } else {
                        const deferred = cliente.pendingBuffer;
                        delete cliente.pendingBuffer;
                        deferred.resolve(message as ArrayBuffer);
                    }
                } else {
                    this.handleMessage(ws, cliente, message);
                }
            });

            ws.on('close', () => {
                if (cliente.pendingBuffer) {
                    cliente.pendingBuffer.reject(new Error('Client disconnected'));
                    delete cliente.pendingBuffer;
                }
                if (cliente.timer) {
                    clearInterval(cliente.timer);
                    delete cliente.timer;
                }
                this.clientes.delete(ws);
            });
        });
    }

    /**
     * Devuelve la ruta normalizada de la petición de upgrade si la reserva algún handler con `ruta`
     * (la conexión queda ligada a ella) o `undefined` si no (conexión solo para handlers globales).
     *
     * @param req - Petición de upgrade.
     */
    private rutaReservada(req: IncomingMessage): string|undefined {
        let ruta: string;
        try {
            ruta = normalizarRuta(req.url ?? "/");
        } catch {
            return undefined;
        }

        return this.handlersRuta.has(ruta) ? ruta : undefined;
    }

    /**
     * Decide en el handshake si se acepta el upgrade. Solo las rutas reservadas por handlers con
     * `autorizar` se comprueban: tienen que autorizar todos; si alguno devuelve `false`, rechaza o lanza,
     * el handshake termina con `401` y el socket no llega a abrirse. El resto de rutas pasan sin cambios.
     *
     * @param req - Petición de upgrade.
     * @param cb - Callback de `verifyClient` de `ws`.
     */
    private verificar(req: IncomingMessage, cb: (res: boolean, code?: number, message?: string) => void): void {
        const ruta = this.rutaReservada(req);
        const autorizadores = ruta !== undefined ? this.autorizadores.get(ruta) : undefined;
        if (autorizadores === undefined || autorizadores.length === 0) {
            cb(true);
            return;
        }

        Promise.all(autorizadores.map(async handler => handler.autorizar!(req)))
            .then(resultados => resultados.every(ok => ok === true))
            .catch((err: unknown) => {
                warning("Error autorizando el upgrade WebSocket", ruta, err);
                return false;
            })
            .then(ok => {
                if (ok) {
                    cb(true);
                } else {
                    cb(false, 401, "Unauthorized");
                }
            });
    }

    /**
     * Parsea y gestiona un mensaje WebSocket entrante.
     *
     * Si el mensaje declara que vendrá seguido de un buffer binario (`data.buffer === true`),
     * crea una {@link Deferred} y espera el siguiente frame binario antes de invocar
     * {@link handleRequest}. En caso de error de parseo o de procesamiento, envía
     * automáticamente un mensaje de error al cliente.
     *
     * @param ws - Socket del cliente que envió el mensaje.
     * @param cliente - Estado interno del cliente.
     * @param message - Datos crudos recibidos por el socket.
     */
    private handleMessage(ws: WS, cliente: IClientMap, message: RawData): void {
        try {
            const data = JSON.parse(message.toString()) as IMessageClient;

            // Rate limiting: rechazar si hay demasiados handlers en vuelo para esta conexión
            if (cliente.activeRequests >= WebSocket.MAX_CONCURRENT_REQUESTS) {
                ws.send(JSON.stringify({
                    id: data.id,
                    ok: false,
                    info: {
                        message: `Too many concurrent requests (max ${WebSocket.MAX_CONCURRENT_REQUESTS})`,
                    },
                } as IMessageServerKO));
                return;
            }
            cliente.activeRequests++;

            const deferred = new Deferred<ArrayBuffer|undefined>();
            if (data.buffer) {
                cliente.pendingBuffer = deferred;
            } else {
                deferred.resolve(undefined);
            }

            deferred.promise
                .then(async (buffer)=>this.handleRequest(ws, data, cliente, buffer))
                .catch(err=>{
                    // Si la conexión ya se cerró no intentar enviar: ws.send() lanzaría una excepción
                    if (ws.readyState !== ws.OPEN) {
                        return;
                    }
                    if (err instanceof Error) {
                        ws.send(JSON.stringify({
                            id: data.id,
                            ok: false,
                            info: {
                                message: err.message,
                            },
                        } as IMessageServerKO));
                    } else {
                        ws.send(JSON.stringify({
                            id: data.id,
                            ok: false,
                            info: {
                                message: `Unknown error ${data.method} (check)`,
                                extra: JSON.stringify(err),
                            },
                        } as IMessageServerKO));
                    }
                })
                .finally(() => {
                    cliente.activeRequests--;
                });
        } catch (err) {
            if (err instanceof Error) {
                ws.send(JSON.stringify({
                    ok: false,
                    info: {
                        message: err.message,
                        extra: message.toString(),
                    },
                } as IMessageServerKO));
            } else {
                ws.send(JSON.stringify({
                    ok: false,
                    info: {
                        message: `Unknown error (check)`,
                        extra: JSON.stringify(err),
                    },
                } as IMessageServerKO));
            }
        }
    }

    /**
     * Busca el handler adecuado para el method/accion indicado y lo invoca.
     *
     * Crea un span hijo de Datadog con nombre `websocket.<method>` que engloba
     * toda la ejecución del handler, incluyendo el tiempo de espera del buffer
     * binario. El span se marca como error si el handler lanza una excepción o
     * si no existe ningún handler registrado para el método recibido.
     *
     * @param ws - Socket del cliente al que se devolverá la respuesta.
     * @param data - Mensaje cliente ya deserializado.
     * @param cliente - Estado interno del cliente: su `traceContext` (span del upgrade HTTP, padre fallback
     *   si el cliente no propaga contexto) y su `ruta`, que decide qué handlers pueden atender el mensaje.
     * @param buffer - Buffer binario opcional asociado al mensaje.
     */
    private async handleRequest(ws: WS, data: IMessageClient, cliente: IClientMap, buffer?: ArrayBuffer): Promise<void> {
        // Preferir el contexto propagado por el cliente sobre el del upgrade HTTP,
        // para enlazar la traza del servidor con la del cliente como traza distribuida.
        const parentContext = data._datadog
            ? tracer.extract(formats.TEXT_MAP, data._datadog)
            : cliente.traceContext;

        const span = tracer.startSpan(`websocket.${data.method}`, {
            childOf: parentContext ?? undefined,
            tags: {
                "span.kind": "server",
                "websocket.method": data.method,
                "websocket.id": data.id,
            },
        });

        return tracer.scope().activate(span, async () => {
            try {
                const handler = (cliente.ruta !== undefined ? this.handlersRuta.get(cliente.ruta) : this.handlers)?.[data.method];
                if (!handler) {
                    throw new Error(`No handler for method ${data.method}`);
                }

                const timeoutMs = handler.timeoutMs ?? WebSocket.HANDLER_TIMEOUT_MS;
                const wsHandler = new WSHandler(ws, data.id, data.method, {buffer, head: data.head, ruta: cliente.ruta, request: cliente.request});

                // Envolver la ejecución del handler en un try/catch independiente para que
                // los errores del handler se entreguen al cliente vía wsHandler (cola FIFO +
                // backpressure) sin propagarse al .catch() externo de handleMessage, que
                // enviaría una segunda respuesta de error directamente sobre el socket.
                try {
                    await PromiseTimeout(handler.handler(wsHandler, data.params), timeoutMs);
                } catch (err) {
                    const finalErr = err instanceof PromiseTimeoutError
                        ? new Error(`Handler timeout (${timeoutMs}ms) for method ${data.method}`)
                        : err;
                    span.setTag("error", finalErr);

                    // Solo enviar error si el handler no completó ya su respuesta
                    if (!wsHandler.isDone) {
                        if (finalErr instanceof Error) {
                            wsHandler.sendError(finalErr.message);
                        } else {
                            wsHandler.sendError(`Unknown error ${data.method}`, JSON.stringify(finalErr));
                        }
                    }
                    // Resolver en lugar de rechazar: el error ya fue entregado al cliente.
                    // El .finally() externo (activeRequests--) sigue ejecutándose.
                }
            } catch (err) {
                // Solo llegan aquí errores de sistema: "no handler for method X".
                // Estos se propagan al .catch() de handleMessage, que los envía directamente.
                span.setTag("error", err);
                return Promise.reject(err);
            } finally {
                span.finish();
            }
        });
    }

    /**
     * Inicia el apagado graceful del servidor WebSocket.
     *
     * 1. Deja de aceptar nuevas conexiones.
     * 2. Envía `"Shutdown"` a los clientes activos y les da {@link MAX_SHUTDOWN_MS}
     *    para cerrar limpiamente. **Con 50 clientes o más el envío se reparte** en una ventana de hasta
     *    10 s (ver {@link ventanaApagadoMs}): los clientes reconectan en cuanto lo reciben, y todos a la vez
     *    saturan a las réplicas que quedan. Con menos de 50, en Cloud Run (`K_SERVICE` definida) o con un
     *    `timeoutMs` que no deja sitio, se envía a todos a la vez. Cada cliente sigue recibiendo sus `Alive`
     *    hasta el momento de su `Shutdown`.
     * 3. Espera hasta `timeoutMs` ms a que todos los clientes se desconecten.
     *    Si el tiempo se agota, fuerza el cierre con `terminate()`. La ventana siempre deja sitio al cierre del
     *    último cliente: nunca pasa de `timeoutMs` - 5 s - 1 s.
     * 4. Elimina la instancia singleton para que una llamada posterior a `createWSServer()`
     *    pueda arrancar un servidor nuevo.
     *
     * @param timeoutMs - Tiempo máximo de espera (ms) antes de forzar el cierre.
     *   Por defecto 30 s.
     */
    public async shutdown(timeoutMs = 30000): Promise<void> {
        this.draining = true;

        // Dejar de aceptar nuevas conexiones HTTP upgrade
        this.server.close();

        // Notificar a los clientes abiertos (repartido si son muchos) y programar el cierre forzoso si no responden
        const abiertos = [...this.clientes.keys()].filter(ws => ws.readyState === ws.OPEN);
        const ventanaMs = ventanaApagadoMs({clientes: abiertos.length, timeoutMs, cloudRun: process.env["K_SERVICE"] !== undefined});
        if (ventanaMs > 0) {
            const ritmo = Math.round(abiertos.length / (ventanaMs / 1000));
            info(`Servidor WebSocket: Shutdown escalonado a ${abiertos.length} clientes en ${ventanaMs} ms (${ritmo} clientes/s)`);
        }
        const retrasos = retrasosApagado({clientes: abiertos.length, ventanaMs, aleatorio: Math.random});
        abiertos.forEach((ws, i) => {
            const despedir = (): void => {
                // Su liveness se detiene justo antes de su Shutdown, no al empezar el apagado: hasta entonces sigue recibiendo `Alive`
                const cliente = this.clientes.get(ws);
                if (cliente?.timer) {
                    clearInterval(cliente.timer);
                    delete cliente.timer;
                }
                if (ws.readyState !== ws.OPEN) {
                    return;
                }
                try {
                    ws.send(WebSocket.MESSAGE_SHUTDOWN);
                } catch {
                    // ignorar: el socket puede estar ya cerrando
                }
                setTimeout(() => {
                    if (ws.readyState === ws.OPEN) {
                        ws.close(1001, "Server shutdown");
                    }
                }, WebSocket.MAX_SHUTDOWN_MS).unref();
            };
            if (retrasos[i] > 0) {
                setTimeout(despedir, retrasos[i]).unref();
            } else {
                despedir();
            }
        });

        // Sin clientes activos: limpiar y resolver
        if (this.clientes.size === 0) {
            instance = undefined;
            return;
        }

        // Esperar hasta que todos los clientes se desconecten o se agote el timeout
        return new Promise<void>((resolve) => {
            const forceTimer = setTimeout(() => {
                clearInterval(pollTimer);
                for (const [ws] of this.clientes) {
                    try { ws.terminate(); } catch { /* ignorar */ }
                }
                instance = undefined;
                resolve();
            }, timeoutMs);

            const pollTimer = setInterval(() => {
                if (this.clientes.size === 0) {
                    clearInterval(pollTimer);
                    clearTimeout(forceTimer);
                    instance = undefined;
                    resolve();
                }
            }, 100).unref();
        });
    }

    /**
     * Registra handlers adicionales en la tabla de enrutamiento.
     *
     * Cada método declarado en {@link IWSHandler.method} se indexa individualmente,
     * de modo que el lookup en {@link handleRequest} es O(1). Si un método ya tenía
     * handler asignado, el nuevo lo sobrescribe.
     *
     * Los handlers con {@link IWSHandler.ruta} van a una tabla propia por ruta; los que no la declaran
     * quedan como globales. Ambos espacios de nombres son independientes: el mismo método puede existir
     * en un handler global y en uno de ruta sin pisarse.
     *
     * Permite una arquitectura modular en la que diferentes módulos registran sus
     * handlers de forma independiente tras la inicialización inicial.
     *
     * @param handlers - Lista de handlers adicionales a registrar.
     */
    public addHandlers(handlers: IWSHandler[]): void {
        for (const handler of handlers) {
            let tabla: Record<string, IWSHandler>;
            if (handler.ruta !== undefined) {
                const ruta = normalizarRuta(handler.ruta);
                tabla = this.handlersRuta.get(ruta) ?? {};
                this.handlersRuta.set(ruta, tabla);
                if (handler.autorizar !== undefined) {
                    const lista = this.autorizadores.get(ruta) ?? [];
                    if (!lista.includes(handler)) {
                        lista.push(handler);
                    }
                    this.autorizadores.set(ruta, lista);
                }
            } else {
                tabla = this.handlers;
            }
            for (const method of handler.method) {
                tabla[method] = handler;
            }
        }
    }
}

let instance: WebSocket|undefined;
export default (http: Server, handlers: IWSHandler[]): WebSocket => {
    if (!instance) {
        instance = new WebSocket(http, handlers);
    } else {
        // El servidor ya está inicializado: acumular los nuevos handlers
        instance.addHandlers(handlers);
    }
    return instance;
};
/**
 * El servidor WebSocket de este proceso, o `undefined` si no se ha creado (o ya se ha cerrado). No lo crea:
 * lo usa `Server.close()` del servidor HTTP para cerrarlo sin depender de quién lo montó.
 */
export function servidorWebSocketActual(): WebSocket|undefined {
    return instance;
}
export type {WebSocket};
