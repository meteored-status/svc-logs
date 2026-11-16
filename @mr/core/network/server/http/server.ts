/**
 * Editor: Bixus
 * Fecha: Mon, 16 Nov 2026 11:00:00 GMT
 * Hash: 585c3d46b87e382e64dfb8bfe9db7dd6
 * Versión: 2026.11.16+2-bixus
 * Anterior: 2026.11.13+1-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

import formidable, {type Fields, type Files} from "formidable";
import {parse, stringify, type IParseOptions} from "qs";
import type {Duplex} from "node:stream";
import type {Socket} from "node:net";
import tls, {type SecureContext} from "node:tls";
import http from "node:http";
import https from "node:https";
import inspector from "node:inspector";

import {error, formatTiempo, info, warning} from "services-comun/modules/utiles/log";
import {isDir, readDir, readFile, readJSON} from "services-comun/modules/utiles/fs";
import {Deferred} from "services-comun/modules/utiles/promise";

import {abortUpgrade, buildUpgradeContext, type IUpgradeHandler, matchUpgradeHandler, protegerSocket} from "./upgrade";
import {Conexion} from "./conexion";
import {PRESUPUESTO_ANTES_DE_CERRAR_MS, PRESUPUESTO_ANTES_DE_SALIR_MS, avisoShutdownTimeout, limiteDuroMs, type Net} from "./config/net";
import {metricas} from "./metrics";
import type {Routes} from "./routes";
import {route} from "./router";
import {esLenta, esperaLenta, textoUmbral, umbralLento} from "./slow";
import {servidorWebSocketActual} from "../websocket";

/** Métodos HTTP que pueden traer cuerpo y que parseamos en `onRequest`. */
const METODOS_CON_CUERPO: ReadonlySet<string> = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/**
 * Opciones de seguridad para `qs.parse`:
 *
 * - `depth: 5` limita anidamientos para evitar payloads tipo `a[b][c]...[z]` que
 *   consumen CPU/RAM exponencialmente.
 * - `parameterLimit: 1000` cota dura de número de parámetros aceptados.
 * - `arrayLimit: 200` cota dura de elementos en arrays nombrados.
 * - `allowPrototypes: false` previene prototype-pollution vía claves como `__proto__`.
 */
const QS_PARSE_OPTIONS: IParseOptions = {
    depth: 5,
    parameterLimit: 1000,
    arrayLimit: 200,
    allowPrototypes: false,
};

/**
 * Ruta admin (solo fuera de producción) que le pide a la instancia que ocupa el
 * puerto HTTP que lo ceda temporalmente a una sesión de depuración.
 * Ver {@link Server.cederPuertoParaDebug}.
 */
export const RUTA_DEBUG_HANDOFF = "/admin/debug-handoff/";

/** Intervalo de reintento de escucha para el proceso que quiere el puerto para depurar (prioridad alta). */
const INTERVALO_REINTENTO_DEBUG_MS = 300;

export {PRESUPUESTO_ANTES_DE_CERRAR_MS, PRESUPUESTO_ANTES_DE_SALIR_MS};

/**
 * Opciones de {@link Server.cerrarYSalir}.
 *
 * @property salir - Función que termina el proceso con el código dado. Por defecto `process.exit`.
 * @property presupuestoAntesDeCerrarMs - Tope de los callbacks de {@link Server.antesDeCerrar}.
 *   Por defecto {@link PRESUPUESTO_ANTES_DE_CERRAR_MS}.
 */
export interface IOpcionesCierre {
    salir?: (codigo: number) => void;
    presupuestoAntesDeCerrarMs?: number;
}

/** Cada cuánto (ms) se cierran las conexiones keep-alive que quedan ociosas mientras dura {@link Server.close}. */
export const INTERVALO_CONEXIONES_OCIOSAS_MS = 150;

/** Intervalo de reintento de escucha para el proceso que espera recuperar el puerto tras la depuración. */
const INTERVALO_REINTENTO_NORMAL_MS = 2000;

/**
 * Indica si el proceso actual corre bajo un depurador de Node.js. PhpStorm inyecta
 * `--inspect`/`--inspect-brk` vía `NODE_OPTIONS` (o `execArgv` en lanzamientos
 * directos) al ejecutar una configuración en modo Debug.
 */
function esModoDebug(): boolean {
    if (inspector.url() !== undefined) {
        return true;
    }
    if (process.execArgv.some((arg) => arg.includes("--inspect"))) {
        return true;
    }
    return (process.env["NODE_OPTIONS"] ?? "").includes("--inspect");
}

/**
 * Avisa a la instancia que ya tiene el puerto HTTP ocupado para que lo libere
 * temporalmente (ver {@link Server.cederPuertoParaDebug}). Nunca rechaza: si la
 * petición falla o no hay nadie escuchando, el intervalo de reintento insistirá.
 */
function avisarInstanciaEnEjecucion(puerto: number): Promise<void> {
    const deferred = new Deferred<void>();
    const peticion = http.request({
        method: "POST",
        host: "127.0.0.1",
        port: puerto,
        path: RUTA_DEBUG_HANDOFF,
        timeout: 2000,
    }, (respuesta) => {
        respuesta.resume();
        deferred.resolve();
    });
    peticion.addListener("error", () => deferred.resolve());
    peticion.addListener("timeout", () => {
        peticion.destroy();
        deferred.resolve();
    });
    peticion.end();
    return deferred.promise;
}

/**
 * Gestiona los servidores HTTP y HTTPS del servicio.
 *
 * Crea y configura instancias de `http.Server` y `https.Server` de Node.js,
 * registra listeners de error, aplica límites de conexiones y timeouts, y
 * delega cada petición entrante al router de rutas.
 *
 * Soporta SNI multi-dominio cargando certificados TLS desde el directorio
 * `files/ssl/<dominio>/` para el servidor HTTPS.
 *
 * El módulo exporta una instancia singleton lista para usar.
 *
 * @example
 * ```ts
 * import server from "@mr/core-network/server/http/server";
 *
 * server.iniciarHTTP(routes, config);
 * await server.iniciarHTTPs(routes, config);
 * ```
 */
export class Server {
    private serverHTTP: http.Server|null;
    private serverHTTPS: https.Server|null;
    private _shuttingDown: boolean;
    private cerrando: boolean;
    private signalsAttached: boolean;
    private netHTTP: Net|null;
    private esperandoPuertoHTTP: NodeJS.Timeout|null;
    private readonly callbacksInicioCierre: (() => void)[];
    private readonly callbacksAntesDeSalir: (() => Promise<void>)[];
    private readonly callbacksAntesDeCerrar: (() => Promise<void>)[];
    private readonly callbacksDuranteCierre: (() => Promise<void>)[];

    public constructor() {
        this.serverHTTP = null;
        this.serverHTTPS = null;
        this._shuttingDown = false;
        this.cerrando = false;
        this.signalsAttached = false;
        this.netHTTP = null;
        this.esperandoPuertoHTTP = null;
        this.callbacksInicioCierre = [];
        this.callbacksAntesDeSalir = [];
        this.callbacksAntesDeCerrar = [];
        this.callbacksDuranteCierre = [];
    }

    /**
     * Registra un callback **síncrono** que se ejecuta al entrar en el cierre por señal (`SIGTERM`/`SIGINT`),
     * antes de `close()`. Sirve para avisar de que el proceso se va a parar mientras aún se puede. Un error
     * del callback se registra con `warning` y no detiene el cierre. Sin callbacks registrados, el cierre
     * no cambia.
     *
     * @param cb - Callback a ejecutar.
     */
    public alIniciarCierre(cb: () => void): void {
        this.callbacksInicioCierre.push(cb);
    }

    /**
     * Registra un callback asíncrono que se ejecuta cuando `close()` ha terminado y justo antes de
     * `process.exit(0)`. Todos los callbacks comparten un presupuesto total de
     * {@link PRESUPUESTO_ANTES_DE_SALIR_MS} ms: pasado ese tiempo se sale igualmente. Los errores se
     * registran con `warning` y no impiden la salida. Sin callbacks registrados, el cierre no cambia.
     *
     * @param cb - Callback a ejecutar.
     */
    public antesDeSalir(cb: () => Promise<void>): void {
        this.callbacksAntesDeSalir.push(cb);
    }

    /**
     * Registra un callback asíncrono que se ejecuta **antes** de `close()`, con el servidor todavía
     * aceptando conexiones y peticiones. Sirve para dar margen a que el pod salga de los endpoints
     * del balanceador antes de dejar de escuchar. Todos los callbacks comparten un presupuesto de
     * {@link PRESUPUESTO_ANTES_DE_CERRAR_MS} ms (inyectable con `presupuestoAntesDeCerrarMs`); los
     * errores se registran con `warning` y no detienen el cierre. {@link isShuttingDown} ya es `true`
     * dentro de ellos, así que `/admin/ready/` responde 503.
     *
     * @param cb - Callback a ejecutar.
     */
    public antesDeCerrar(cb: () => Promise<void>): void {
        this.callbacksAntesDeCerrar.push(cb);
    }

    /**
     * Registra un callback asíncrono que se ejecuta **en paralelo** con `close()` y comparte con él el
     * plazo `shutdownTimeout`: la salida espera a que terminen los dos o a que venza el plazo (con un
     * `warning`). Los errores se registran con `warning`. Pensado para el `shutdown()` del Engine.
     *
     * @param cb - Callback a ejecutar.
     */
    public duranteCierre(cb: () => Promise<void>): void {
        this.callbacksDuranteCierre.push(cb);
    }

    /**
     * Indica si este servidor atiende él mismo `SIGTERM`/`SIGINT` (ya escucha y registró sus señales).
     * Si es `false`, la señal debe atenderla quien arranca el proceso.
     */
    public gestionaSenales(): boolean {
        return this.signalsAttached;
    }

    /**
     * Indica si el servidor está en proceso de cierre graceful. Mientras sea `true`,
     * el endpoint `/admin/ready/` responderá con 503 para que el orquestador
     * (GKE/Istio) deje de enviarle tráfico nuevo.
     */
    public isShuttingDown(): boolean {
        return this._shuttingDown;
    }

    /**
     * Cierra los servidores HTTP/HTTPS de forma graceful: deja de aceptar conexiones
     * nuevas y espera a que las en curso terminen. Si pasados `timeoutMs` ms quedan
     * conexiones vivas se cierran forzosamente con `closeAllConnections()`.
     *
     * `http.Server.close()` no resuelve mientras quede una conexión abierta, y ni un WebSocket entrante
     * (el socket upgradeado ya no es del servidor HTTP) ni una keep-alive con una petición en vuelo se
     * cierran solos. Por eso, mientras dura el cierre:
     *
     * - Se cierra **en paralelo el servidor WebSocket** de este proceso, si lo hay
     *   ({@link servidorWebSocketActual}): manda `Shutdown` a los clientes para que se reconecten a una
     *   réplica viva y les da unos segundos para cerrar.
     * - Cada {@link INTERVALO_CONEXIONES_OCIOSAS_MS} ms se llama a `closeIdleConnections()`, que cierra las
     *   keep-alive que ya han terminado su petición.
     *
     * Sin eso, `close()` solo salía por `timeoutMs` y, en producción, el SIGKILL llegaba antes de
     * `antesDeSalir`.
     *
     * Se invoca automáticamente al recibir `SIGTERM` o `SIGINT`; también puede
     * llamarse manualmente desde el ciclo de vida del servicio.
     *
     * @param timeoutMs - Tiempo máximo en ms a esperar el drenado. `0` desactiva el corte forzoso.
     */
    public async close(timeoutMs: number): Promise<void> {
        if (this.cerrando) {
            return;
        }
        this.cerrando = true;
        this._shuttingDown = true;

        const timers: NodeJS.Timeout[] = [];
        const cerrar = (srv: http.Server|https.Server|null): Promise<void> => {
            if (srv === null) {
                return Promise.resolve();
            }
            return new Promise<void>((resolve) => {
                let terminado = false;
                const fin = (): void => {
                    if (terminado) {
                        return;
                    }
                    terminado = true;
                    resolve();
                };
                srv.close(() => fin());
                const ociosas = setInterval(() => {
                    try {
                        srv.closeIdleConnections?.();
                    } catch {
                        // ignorar
                    }
                }, INTERVALO_CONEXIONES_OCIOSAS_MS);
                ociosas.unref();
                timers.push(ociosas);
                if (timeoutMs > 0) {
                    const forzar = setTimeout(() => {
                        try {
                            srv.closeAllConnections?.();
                        } catch {
                            // ignorar
                        }
                        fin();
                    }, timeoutMs);
                    forzar.unref();
                    timers.push(forzar);
                }
            });
        };

        const webSocket = servidorWebSocketActual();
        const cierreWebSocket = webSocket !== undefined ?
            webSocket.shutdown(timeoutMs > 0 ? timeoutMs : undefined).catch((err: unknown) => {
                warning("Error cerrando el servidor WebSocket", err);
            }) :
            Promise.resolve();

        try {
            await Promise.all([cerrar(this.serverHTTP), cerrar(this.serverHTTPS), cierreWebSocket]);
        } finally {
            for (const timer of timers) {
                clearInterval(timer);
                clearTimeout(timer);
            }
        }
    }

    /**
     * Secuencia de cierre por señal: marca {@link isShuttingDown}, callbacks de {@link alIniciarCierre} y de
     * {@link antesDeCerrar} (el margen de endpoints), `close()` en paralelo con {@link duranteCierre},
     * callbacks de {@link antesDeSalir} (con su presupuesto) y salida. La salida es inyectable para poder
     * probar el orden sin terminar el proceso.
     *
     * Orden: (1) {@link isShuttingDown} pasa a `true`; (2) {@link alIniciarCierre}; (3) {@link antesDeCerrar}
     * con su tope; (4) se arma el límite duro (después del margen, para que éste no lo consuma);
     * (5) `close()` en paralelo con {@link duranteCierre}, acotado a `shutdownTimeout`; (6)
     * {@link antesDeSalir}; (7) salida.
     *
     * @param config - Configuración de red (`shutdownTimeout`).
     * @param opciones - Salida inyectable y tope de {@link antesDeCerrar}.
     */
    public async cerrarYSalir(config: Net, {salir = (codigo) => process.exit(codigo), presupuestoAntesDeCerrarMs = PRESUPUESTO_ANTES_DE_CERRAR_MS}: IOpcionesCierre = {}): Promise<void> {
        this._shuttingDown = true;

        for (const cb of this.callbacksInicioCierre) {
            try {
                cb();
            } catch (err) {
                warning("Error en un callback de inicio de cierre", err);
            }
        }

        await this.ejecutarConPresupuesto(this.callbacksAntesDeCerrar, presupuestoAntesDeCerrarMs, "antesDeCerrar");

        // Hard safety: si por cualquier razón `close()` no resuelve (handles activos que no
        // sueltan, un `antesDeSalir` colgado…) salimos forzosamente para no colgar al
        // orquestador/watcher. Es `shutdownTimeout` + el presupuesto de `antesDeSalir` + 1 s
        // de margen, y no el doble del timeout como antes: el doble quedaba por encima de los
        // 25 s de `terminationGracePeriodSeconds`, así que en Kubernetes este seguro no llegaba
        // nunca a actuar antes del SIGKILL. Con 18 s en producción son 20 s, y se arma tras el
        // margen de `antesDeCerrar` (hasta 3 s), así que el peor caso son 23 s desde el preStop.
        const hardLimitMs = limiteDuroMs(config.shutdownTimeout);
        const hardTimeout = setTimeout(() => {
            warning("Shutdown graceful no finalizó a tiempo; forzando salida");
            salir(1);
        }, hardLimitMs);
        hardTimeout.unref();

        const cierre = this.close(config.shutdownTimeout).catch((err: unknown) => {
            error("Error en shutdown graceful", err);
        });
        await Promise.all([cierre, this.ejecutarDuranteCierre(config.shutdownTimeout)]);

        await this.ejecutarConPresupuesto(this.callbacksAntesDeSalir, PRESUPUESTO_ANTES_DE_SALIR_MS, "antesDeSalir");

        clearTimeout(hardTimeout);
        // Registrar el listener de señal anula el comportamiento por defecto
        // de Node (terminar el proceso), por lo que debemos salir explícitamente
        // una vez se ha drenado el servidor.
        salir(0);
    }

    /**
     * Ejecuta callbacks en paralelo con un presupuesto total; pasado el presupuesto se sigue adelante con
     * un `warning`. Los errores de cada callback se registran con `warning`. Nunca rechaza.
     */
    private async ejecutarConPresupuesto(callbacks: (() => Promise<void>)[], presupuestoMs: number, nombre: string): Promise<void> {
        if (callbacks.length === 0) {
            return;
        }

        const deferred = new Deferred<void>();
        const timer = setTimeout(() => {
            warning(`Los callbacks de ${nombre} superaron el presupuesto de ${presupuestoMs} ms`);
            deferred.resolve();
        }, presupuestoMs);
        timer.unref();

        Promise.all(callbacks.map(async (cb) => {
            try {
                await cb();
            } catch (err) {
                warning(`Error en un callback de ${nombre}`, err);
            }
        })).then(() => deferred.resolve(), () => deferred.resolve());

        await deferred.promise;
        clearTimeout(timer);
    }

    /**
     * Ejecuta los callbacks de {@link duranteCierre} en paralelo, acotados al plazo `shutdownTimeout`
     * (`0` = sin tope). Nunca rechaza.
     */
    private async ejecutarDuranteCierre(timeoutMs: number): Promise<void> {
        if (timeoutMs <= 0) {
            await Promise.all(this.callbacksDuranteCierre.map(async (cb) => {
                try {
                    await cb();
                } catch (err) {
                    warning("Error en un callback de duranteCierre", err);
                }
            }));
            return;
        }
        await this.ejecutarConPresupuesto(this.callbacksDuranteCierre, timeoutMs, "duranteCierre");
    }

    private attachSignals(config: Net): void {
        if (this.signalsAttached) {
            return;
        }
        this.signalsAttached = true;

        // El aviso del recorte del `shutdownTimeout` sale aquí, una vez al arrancar, y no al construir `Net`: `config/net.ts` lo carga
        // también el navegador y no puede importar el log del servidor.
        const aviso = avisoShutdownTimeout(config);
        if (aviso !== null) {
            warning(aviso);
        }

        const onSignal = (signal: NodeJS.Signals): void => {
            if (this._shuttingDown) {
                return;
            }
            info(`Recibida señal ${signal}; iniciando shutdown graceful`);
            this.cerrarYSalir(config).catch(() => undefined);
        };

        process.once("SIGTERM", onSignal);
        process.once("SIGINT", onSignal);
    }

    /**
     * Aplica timeouts y listeners comunes (timeouts coherentes con Envoy, `clientError`).
     * Debe llamarse después de `server.listen()` para que los timeouts surtan efecto.
     */
    private configurarServidor(srv: http.Server|https.Server, config: Net): void {
        srv.keepAliveTimeout = config.keepAliveTimeout;
        srv.headersTimeout = config.headersTimeout;
        if (config.timeout !== undefined) {
            srv.timeout = config.timeout;
        }
        if (config.maxConnections !== undefined) {
            srv.maxConnections = config.maxConnections;
        }
        srv.on("clientError", (err: NodeJS.ErrnoException, socket: Socket) => {
            if (err.code === "ECONNRESET" || socket.destroyed || !socket.writable) {
                return;
            }
            socket.end("HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n");
        });
    }

    /**
     * Crea y arranca el servidor HTTP si aún no está iniciado.
     * Si ya existe una instancia previa, la devuelve sin crear otra.
     *
     * @param requestHandlers - Tabla de rutas que procesará las peticiones.
     * @param config          - Configuración de red (puertos, timeouts, límites…).
     * @param upgrades        - Descriptores de upgrade (`Upgrade:` HTTP/1.1) recogidos de los
     *   grupos de rutas. Si la lista está vacía no se registra listener de `'upgrade'`, de modo
     *   que el comportamiento de un servicio que no los use queda intacto.
     * @returns La instancia de `http.Server` en escucha.
     */
    public iniciarHTTP(requestHandlers: Routes, config: Net, upgrades: IUpgradeHandler[] = []): http.Server {
        if (this.serverHTTP === null) {
            const server = http.createServer((request: http.IncomingMessage, response: http.ServerResponse) => {
                this.onRequest(request, response, requestHandlers, config, false);
            });
            if (upgrades.length > 0) {
                server.addListener("upgrade", this.crearListenerUpgrade(server, upgrades, config, false));
            }
            server.addListener("error", (err: NodeJS.ErrnoException) => {
                if (!PRODUCCION && err.code === "EADDRINUSE") {
                    this.gestionarPuertoOcupadoHTTP(server, config);
                    return;
                }
                error("Error de servidor HTTP", err);
            });
            // Listener persistente (no `once` vía el callback de `.listen()`): se registra
            // una única vez aquí para que los reintentos de `escucharHTTP` (fuera de
            // producción, tras un `EADDRINUSE`) no acumulen un listener `once` colgado por
            // cada intento fallido (el evento `"error"`, no `"listening"`, es el que dispara
            // en esos intentos, así que el `once` nunca se consume y se queda huérfano).
            server.addListener("listening", () => {
                if (this.esperandoPuertoHTTP !== null) {
                    clearInterval(this.esperandoPuertoHTTP);
                    this.esperandoPuertoHTTP = null;
                    info(`Puerto HTTP ${config.puertos.http} recuperado; servidor web reanudado en:`, config.endpoints.http);
                } else if (!PRODUCCION) {
                    info("Servidor Web iniciado en:", config.endpoints.http);
                }
            });
            this.escucharHTTP(server, config);
            this.configurarServidor(server, config);
            this.attachSignals(config);

            this.serverHTTP = server;
            this.netHTTP = config;
        }

        return this.serverHTTP;
    }

    /**
     * Arranca (o reintenta) la escucha del servidor HTTP en el puerto configurado.
     * El resultado se notifica vía el listener persistente `"listening"` registrado
     * una única vez en `iniciarHTTP` (no aquí), precisamente para que los reintentos
     * sucesivos no acumulen un listener `once` por cada intento fallido.
     */
    private escucharHTTP(server: http.Server, config: Net): void {
        server.listen(config.puertos.http);
    }

    /**
     * Gestiona un puerto HTTP ocupado (`EADDRINUSE`) fuera de producción. Si este
     * proceso corre bajo un depurador (ver {@link esModoDebug}), avisa a la
     * instancia en ejecución para que ceda el puerto y reintenta la escucha con
     * un intervalo corto; si no, asume que el puerto lo tiene una sesión de
     * depuración propia y reintenta con un intervalo más largo hasta recuperarlo.
     */
    private gestionarPuertoOcupadoHTTP(server: http.Server, config: Net): void {
        const debug = esModoDebug();
        if (debug) {
            avisarInstanciaEnEjecucion(config.puertos.http).finally(() => undefined);
        }
        if (this.esperandoPuertoHTTP !== null) {
            return;
        }
        const intervalo = debug ? INTERVALO_REINTENTO_DEBUG_MS : INTERVALO_REINTENTO_NORMAL_MS;
        warning(`Puerto HTTP ${config.puertos.http} ocupado; esperando a que quede libre (reintento cada ${intervalo}ms)...`);
        this.esperandoPuertoHTTP = setInterval(() => {
            this.escucharHTTP(server, config);
        }, intervalo);
    }

    /**
     * Cierra el servidor HTTP para cederle el puerto a una sesión de depuración y
     * queda reintentando la escucha en el mismo puerto hasta recuperarlo cuando esa
     * sesión termine. Solo tiene efecto fuera de producción; la invoca el endpoint
     * `/admin/debug-handoff/`.
     */
    public async cederPuertoParaDebug(): Promise<void> {
        if (PRODUCCION || this.serverHTTP === null || this.netHTTP === null || this.esperandoPuertoHTTP !== null) {
            return;
        }
        const server = this.serverHTTP;
        const config = this.netHTTP;
        info(`Cediendo puerto HTTP ${config.puertos.http} a sesión de depuración...`);
        const deferred = new Deferred<void>();
        server.close(() => deferred.resolve());
        server.closeAllConnections?.();
        await deferred.promise;
        this.gestionarPuertoOcupadoHTTP(server, config);
    }

    /**
     * Crea y arranca el servidor HTTPS con soporte SNI multi-dominio si aún no está iniciado.
     * Carga los certificados TLS desde `files/ssl/<dominio>/privkey.pem` y
     * `files/ssl/<dominio>/fullchain.pem` para cada directorio encontrado.
     * Si ya existe una instancia previa, la devuelve sin crear otra.
     *
     * @param requestHandlers - Tabla de rutas que procesará las peticiones.
     * @param config          - Configuración de red (puertos, timeouts, límites…).
     * @param upgrades        - Descriptores de upgrade (`Upgrade:` HTTP/1.1) recogidos de los
     *   grupos de rutas. Ver {@link iniciarHTTP}.
     * @returns La instancia de `https.Server` en escucha.
     */
    public async iniciarHTTPs(requestHandlers: Routes, config: Net, upgrades: IUpgradeHandler[] = []): Promise<https.Server> {
        if (PRODUCCION) {
            // En producción TLS lo termina Istio/ASM y la app habla HTTP plano dentro del
            // pod, por lo que `iniciarHTTPs` no debe usarse: lanzar un servidor TLS aquí
            // duplicaría handshakes y consumiría memoria sin sentido. Reportamos y abortamos.
            error("iniciarHTTPs invocado en PRODUCCION; ignorado (TLS lo termina ASM)");
            return Promise.reject(new Error("iniciarHTTPs no debe usarse en producción"));
        }
        if (this.serverHTTPS === null) {
            const contextos = new Map<string, SecureContext>();
            for (const dir of await readDir("files/ssl")) {
                if (!await isDir(`files/ssl/${dir}`)) {
                    continue;
                }

                info("Cargando certificados para:", dir);
                const dominios = await readJSON<string[]>(`files/ssl/${dir}/dominios.json`);
                const contexto = tls.createSecureContext({
                    key: await readFile(`files/ssl/${dir}/privkey.pem`),
                    cert: await readFile(`files/ssl/${dir}/fullchain.pem`),
                });
                for (const dominio of dominios) {
                    contextos.set(dominio, contexto);
                }
            }

            const server = https.createServer({
                cert: await readFile("files/ssl/fullchain.pem"),
                key: await readFile("files/ssl/privkey.pem"),
                SNICallback: (servername: string, cb: (err: Error|null, ctx?: SecureContext) => void) => {
                    cb(null, contextos.get(servername));
                },
            }, (request: http.IncomingMessage, response: http.ServerResponse) => {
                this.onRequest(request, response, requestHandlers, config, true);
            });
            if (upgrades.length > 0) {
                server.addListener("upgrade", this.crearListenerUpgrade(server, upgrades, config, true));
            }
            server.addListener("error", (err) => {
                error("Error de servidor HTTPS", err);
            });
            server.listen(config.puertos.https, () => {
                if (!PRODUCCION) {
                    info("Servidor Web Seguro iniciado en:", config.endpoints.https);
                }
            });
            this.configurarServidor(server, config);
            this.attachSignals(config);

            this.serverHTTPS = server;
        }

        return this.serverHTTPS;
    }

    /**
     * Construye el listener del evento nativo `'upgrade'` para un servidor concreto.
     *
     * Node destruye el socket por defecto cuando llega una petición con cabecera `Upgrade:`
     * y nadie escucha ese evento; este listener es el punto de entrada que permite atenderla
     * o reenviarla a otro backend (ver `upgrade.ts`).
     *
     * Convive con otros listeners de `'upgrade'` sin pisarlos: si ningún descriptor hace match
     * pero hay más listeners registrados (el caso típico es el servidor WebSocket de `ws`, que
     * se engancha después de arrancar el servidor HTTP), no se toca el socket y se le deja
     * responder a él. La combinación inversa —un descriptor que hace match en un servicio que
     * *además* termina WebSockets propios— sí produciría dos respuestas sobre el mismo socket,
     * porque un listener no puede cancelar la emisión del evento a los demás; por eso el
     * `Engine` avisa por log cuando un servicio declara ambas cosas a la vez.
     *
     * @param server   - Servidor nativo al que se asocia el listener.
     * @param upgrades - Descriptores declarados por los grupos de rutas, en orden.
     * @param config   - Configuración de red (se usa `trustProxy` para resolver el host).
     * @param seguro   - `true` si el servidor es el HTTPS.
     */
    private crearListenerUpgrade(server: http.Server|https.Server, upgrades: IUpgradeHandler[], config: Net, seguro: boolean): (request: http.IncomingMessage, socket: Duplex, head: Buffer) => void {
        return (request: http.IncomingMessage, socket: Duplex, head: Buffer): void => {
            // Antes que nada: el socket llega sin listener de error y cualquier corte del
            // cliente durante la negociación derribaría el proceso.
            protegerSocket(socket);

            const contexto = buildUpgradeContext(request, socket, head, {
                https: seguro,
                trustProxy: config.trustProxy,
            });

            const handler = matchUpgradeHandler(upgrades, contexto);
            if (handler === undefined) {
                if (server.listenerCount("upgrade") > 1) {
                    return;
                }
                warning("Upgrade sin handler", contexto.dominio, contexto.path);
                abortUpgrade(socket, 404, "Not Found");
                return;
            }

            handler.handler(contexto)
                .catch((err: unknown) => {
                    error("Error atendiendo upgrade", handler.resumen, contexto.dominio, contexto.path, err);
                    abortUpgrade(socket, 502, "Bad Gateway");
                });
        };
    }

    /**
     * Gestiona una petición HTTP/HTTPS entrante: crea la {@link Conexion}, determina
     * el método y el tipo de contenido, parsea el cuerpo si procede y delega en el
     * router de rutas.
     *
     * Flujo para métodos sin cuerpo (`GET`, `HEAD`, etc.):
     * 1. Consume y descarta el stream de datos.
     * 2. En `end`, inicia la conexión y la enruta.
     * 3. Activa un timeout de respuesta lenta si está configurado.
     *
     * Flujo para métodos con cuerpo (`POST`, `PUT`):
     * - **multipart / octet-stream**: parsea con `formidable`.
     * - **Otros** (`application/json`, `application/x-www-form-urlencoded`, texto…):
     *   acumula chunks y parsea con `JSON.parse`/`qs` según el tipo. JSON se acumula a
     *   mano en vez de pasar por `formidable` para que `postRAW` sean los bytes tal cual
     *   llegaron: `formidable` solo expone los `fields` ya parseados, así que `postRAW`
     *   tenía que reconstruirse con `JSON.stringify(fields)`, que no es necesariamente
     *   idéntico byte a byte al body original (orden de claves, escapado…). Eso rompe a
     *   cualquier consumidor que verifique una firma HMAC sobre el body crudo (p. ej. los
     *   webhooks de Stripe en `panel-usuarios-payments-webhook`).
     *
     * @param request         - Petición entrante de Node.js.
     * @param response        - Respuesta de Node.js.
     * @param requestHandlers - Tabla de rutas activa.
     * @param config          - Configuración de red.
     * @param seguro          - `true` si la conexión llega por HTTPS.
     */
    private onRequest(request: http.IncomingMessage, response: http.ServerResponse, requestHandlers: Routes, config: Net, seguro: boolean): void {
        // Tras `close()` una petición por una keep-alive ya abierta se sigue atendiendo (Node emite `request` al
        // parsearla, así que también las encadenadas que llegaron antes del cierre) y la conexión se quedaría
        // reutilizable: con `Connection: close` el proxy (Envoy) no vuelve a usar ese socket. Se decide al
        // escribir las cabeceras, no al recibir la petición, para cubrir las que estaban en vuelo.
        const escribirCabeceras = response.writeHead.bind(response) as (...args: unknown[]) => http.ServerResponse;
        (response as unknown as {writeHead: (...args: unknown[]) => http.ServerResponse}).writeHead = (...args: unknown[]): http.ServerResponse => {
            if (this.cerrando && !response.headersSent) {
                response.setHeader("Connection", "close");
            }

            return escribirCabeceras(...args);
        };
        // Solo confiamos en `x-forwarded-proto` si la configuración nos indica que estamos detrás de un proxy.
        let https = seguro;
        if (config.trustProxy) {
            const proto = request.headers["x-forwarded-proto"];
            if (typeof proto === "string" && proto.length > 0) {
                https = proto.split(",")[0]?.trim().toLowerCase() === "https";
            }
        }
        const conexion = new Conexion(request, response, requestHandlers.error, config, https);

        // Registramos la métrica una sola vez por petición, ya sea por `finish`
        // (respuesta completa) o por `close` (cliente cerró antes de terminar).
        //
        // NOTA: no emitimos log por petición. Envoy (sidecar de Istio/ASM) ya
        // produce access logs estructurados con method/path/status/latency/IP/UA/
        // request_id, por lo que duplicarlo en la aplicación solo dobla coste de
        // ingesta sin aportar información nueva.
        let metricaRegistrada = false;
        const registrarMetrica = (): void => {
            if (metricaRegistrada) {
                return;
            }
            metricaRegistrada = true;
            metricas.observe(
                conexion.metodo,
                response.statusCode,
                Date.now() - conexion.start.getTime(),
            );
        };
        response.once("finish", registrarMetrica);
        response.once("close", registrarMetrica);

        if (!METODOS_CON_CUERPO.has(conexion.metodo)) {
            request.setEncoding("utf8");
            request.addListener("data", () => undefined);
            request.addListener("error", (err: NodeJS.ErrnoException) => {
                switch (err.code) {
                    case "ECONNRESET":
                        break;
                    default:
                        error("Error de request (GET)", err);
                        break;
                }
                request.removeAllListeners();
                conexion.error(500, err.message, err).finally(() => undefined);
            });
            request.addListener("end", () => {
                // El aviso se arma con el umbral del servidor porque aún no se sabe qué ruta atenderá la
                // petición; cuando vence, se mira el umbral efectivo (el de la ruta, si fijó uno) y, si es
                // mayor, se reprograma por lo que falte. `config.slow = 0` lo apaga para todo el servidor.
                const vigilada = config.slow > 0;
                let timeout: NodeJS.Timeout|undefined;
                const vigilar = (espera: number): void => {
                    timeout = setTimeout(() => {
                        const umbral = umbralLento(config.slow, conexion.slow);
                        const falta = esperaLenta(umbral, Date.now() - conexion.start.getTime());
                        if (falta === null) {
                            return;
                        }
                        if (falta > 0) {
                            vigilar(falta);
                            return;
                        }
                        warning(`Tiempo de respuesta excesivo (>${textoUmbral(umbral)})`, conexion.url);
                    }, espera);
                };
                if (vigilada) {
                    vigilar(config.slow);
                }
                conexion.iniciado();
                request.removeAllListeners();
                route(requestHandlers, conexion).finally(() => {
                    if (vigilada) {
                        clearTimeout(timeout);
                        const intervalo = Date.now() - conexion.start.getTime();
                        if (esLenta(umbralLento(config.slow, conexion.slow), intervalo)) {
                            warning(`Tiempo de respuesta excesivo (${formatTiempo(intervalo)})`, conexion.url);
                        }
                    }
                });
            });
        } else {
            const type = conexion.getHeaders()["content-type"]?.toLowerCase() ?? "";
            if (type.includes("multipart") || type.includes("octet-stream")) {
                formidable({
                    encoding: "utf-8",
                    keepExtensions: true,
                    multiples: true,
                    uploadDir: config.uploadDir,
                    maxFileSize: config.maxFileSize,
                    maxTotalFileSize: config.maxFileSize * 10,
                }).parse(request, (err: NodeJS.ErrnoException, fields: Fields, files: Files) => {
                    if (!err) {
                        if (type.includes("multipart")) {
                            const parts: string[] = [];
                            for (const key of Object.keys(fields)) {
                                const values = fields[key];
                                for (const value of Array.isArray(values) ? values : [values]) {
                                    parts.push(stringify({[key]: value}));
                                }
                            }
                            const parsed = parse(parts.join("&"), QS_PARSE_OPTIONS);
                            conexion.post = parsed;
                            conexion.postRAW = JSON.stringify(parsed);
                        } else {
                            conexion.post = fields;
                            conexion.postRAW = JSON.stringify(fields);
                        }
                        conexion.files = files;
                        conexion.iniciado();
                        route(requestHandlers, conexion).finally(() => undefined);
                    } else {
                        error("Error de request (parseando datos [formidable])", conexion.get, JSON.stringify(err));
                        conexion.error(500, err.message, err).finally(() => undefined);
                    }
                });
            } else {
                const chunks: Buffer[] = [];
                let bytes = 0;
                let abortado = false;
                const limite = config.maxRequestBodySize;
                request.addListener("data", (chunk: Buffer) => {
                    if (abortado) {
                        return;
                    }
                    bytes += chunk.length;
                    if (bytes > limite) {
                        abortado = true;
                        request.removeAllListeners();
                        request.destroy();
                        conexion.error(413, "Payload demasiado grande").finally(() => undefined);
                        return;
                    }
                    chunks.push(chunk);
                });
                request.addListener("error", (err: NodeJS.ErrnoException) => {
                    switch (err.code) {
                        case "ECONNRESET":
                            break;
                        default:
                            error("Error de request (parseando datos [custom])", err);
                            break;
                    }
                    request.removeAllListeners();
                    conexion.error(500, err.message, err).finally(() => undefined);
                });
                request.addListener("end", () => {
                    if (abortado) {
                        return;
                    }
                    conexion.postRAW = Buffer.concat(chunks).toString("utf-8");
                    if (type.includes("urlencoded")) {
                        conexion.post = parse(conexion.postRAW, QS_PARSE_OPTIONS);
                    } else if (type.includes("json") && conexion.postRAW.length > 0) {
                        try {
                            conexion.post = JSON.parse(conexion.postRAW);
                        } catch (err) {
                            // 400 y no 500: el cuerpo que no se deja parsear lo ha mandado mal el cliente, y el
                            // servicio no ha fallado en nada. Con un 500 contaría como error del servidor en las
                            // métricas y en los reintentos de quien llama, que volvería a mandar el mismo cuerpo roto.
                            warning("Petición con JSON mal formado", conexion.get, err);
                            conexion.error(400, (err as Error).message, err).finally(() => undefined);
                            return;
                        }
                    } else if (type.includes("json") && conexion.postRAW.length > 0) {
                        try {
                            conexion.post = JSON.parse(conexion.postRAW);
                        } catch (err) {
                            // 400 y no 500: el cuerpo que no se deja parsear lo ha mandado mal el cliente, y el
                            // servicio no ha fallado en nada. Con un 500 contaría como error del servidor en las
                            // métricas y en los reintentos de quien llama, que volvería a mandar el mismo cuerpo roto.
                            warning("Petición con JSON mal formado", conexion.get, err);
                            conexion.error(400, (err as Error).message, err).finally(() => undefined);
                            return;
                        }
                    }
                    conexion.iniciado();
                    request.removeAllListeners();
                    route(requestHandlers, conexion).finally(() => undefined);
                });
            }
        }
    }
}

export default new Server();
