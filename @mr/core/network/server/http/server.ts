/**
 * Editor: José Antonio Jiménez
 * Fecha: Mon, 18 May 2026 10:42:05 GMT
 * Hash: 48ee3d20b2ea8bf248df1f81ba92c3d3
 * Versión: 2026.5.18+2-josantoniojimnez
 */

import formidable, {type Fields, type Files} from "formidable";
import {parse, stringify, type IParseOptions} from "qs";
import type {Socket} from "node:net";
import tls, {type SecureContext} from "node:tls";
import http from "node:http";
import https from "node:https";

import {error, formatTiempo, info, warning} from "services-comun/modules/utiles/log";
import {isDir, readDir, readFile, readJSON} from "services-comun/modules/utiles/fs";

import {Conexion} from "./conexion";
import type {Net} from "./config/net";
import {metricas} from "./metrics";
import type {Routes} from "./routes";
import {route} from "./router";

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
    private signalsAttached: boolean;

    public constructor() {
        this.serverHTTP = null;
        this.serverHTTPS = null;
        this._shuttingDown = false;
        this.signalsAttached = false;
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
     * Se invoca automáticamente al recibir `SIGTERM` o `SIGINT`; también puede
     * llamarse manualmente desde el ciclo de vida del servicio.
     *
     * @param timeoutMs - Tiempo máximo en ms a esperar el drenado. `0` desactiva el corte forzoso.
     */
    public async close(timeoutMs: number): Promise<void> {
        if (this._shuttingDown) {
            return;
        }
        this._shuttingDown = true;

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
                if (timeoutMs > 0) {
                    setTimeout(() => {
                        try {
                            srv.closeAllConnections?.();
                        } catch {
                            // ignorar
                        }
                        fin();
                    }, timeoutMs).unref();
                }
            });
        };

        await Promise.all([cerrar(this.serverHTTP), cerrar(this.serverHTTPS)]);
    }

    private attachSignals(config: Net): void {
        if (this.signalsAttached) {
            return;
        }
        this.signalsAttached = true;

        const onSignal = (signal: NodeJS.Signals): void => {
            if (this._shuttingDown) {
                return;
            }
            info(`Recibida señal ${signal}; iniciando shutdown graceful`);

            // Hard safety: si por cualquier razón `close()` no resuelve (sockets keep-alive
            // que no drenan, handles activos, etc.) salimos forzosamente al doble del
            // `shutdownTimeout` para no colgar al orquestador/watcher.
            const hardLimitMs = Math.max(config.shutdownTimeout * 2, 5_000);
            const hardTimeout = setTimeout(() => {
                warning("Shutdown graceful no finalizó a tiempo; forzando salida");
                process.exit(1);
            }, hardLimitMs);
            hardTimeout.unref();

            this.close(config.shutdownTimeout)
                .catch((err) => {
                    error("Error en shutdown graceful", err);
                })
                .finally(() => {
                    clearTimeout(hardTimeout);
                    // Registrar el listener de señal anula el comportamiento por defecto
                    // de Node (terminar el proceso), por lo que debemos salir explícitamente
                    // una vez se ha drenado el servidor.
                    process.exit(0);
                });
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
     * @returns La instancia de `http.Server` en escucha.
     */
    public iniciarHTTP(requestHandlers: Routes, config: Net): http.Server {
        if (this.serverHTTP === null) {
            const server = http.createServer((request: http.IncomingMessage, response: http.ServerResponse) => {
                this.onRequest(request, response, requestHandlers, config, false);
            });
            server.addListener("error", (err) => {
                error("Error de servidor HTTP", err);
            });
            server.listen(config.puertos.http, () => {
                if (!PRODUCCION) {
                    info("Servidor Web iniciado en:", config.endpoints.http);
                }
            });
            this.configurarServidor(server, config);
            this.attachSignals(config);

            this.serverHTTP = server;
        }

        return this.serverHTTP;
    }

    /**
     * Crea y arranca el servidor HTTPS con soporte SNI multi-dominio si aún no está iniciado.
     * Carga los certificados TLS desde `files/ssl/<dominio>/privkey.pem` y
     * `files/ssl/<dominio>/fullchain.pem` para cada directorio encontrado.
     * Si ya existe una instancia previa, la devuelve sin crear otra.
     *
     * @param requestHandlers - Tabla de rutas que procesará las peticiones.
     * @param config          - Configuración de red (puertos, timeouts, límites…).
     * @returns La instancia de `https.Server` en escucha.
     */
    public async iniciarHTTPs(requestHandlers: Routes, config: Net): Promise<https.Server> {
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
     * - **JSON / multipart / octet-stream**: parsea con `formidable`.
     * - **Otros** (`application/x-www-form-urlencoded`, texto…): acumula chunks
     *   y parsea con `qs` si el tipo es `urlencoded`.
     *
     * @param request         - Petición entrante de Node.js.
     * @param response        - Respuesta de Node.js.
     * @param requestHandlers - Tabla de rutas activa.
     * @param config          - Configuración de red.
     * @param seguro          - `true` si la conexión llega por HTTPS.
     */
    private onRequest(request: http.IncomingMessage, response: http.ServerResponse, requestHandlers: Routes, config: Net, seguro: boolean): void {
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
                const timeout: NodeJS.Timeout|undefined = config.slow > 0
                    ? setTimeout(() => {
                        warning("Tiempo de respuesta excesivo (>1sg)", conexion.url);
                    }, config.slow)
                    : undefined;
                conexion.iniciado();
                request.removeAllListeners();
                route(requestHandlers, conexion).finally(() => {
                    if (timeout !== undefined) {
                        clearTimeout(timeout);
                        const intervalo = Date.now() - conexion.start.getTime();
                        if (intervalo > 1000) {
                            warning(`Tiempo de respuesta excesivo (${formatTiempo(intervalo)})`, conexion.url);
                        }
                    }
                });
            });
        } else {
            const type = conexion.getHeaders()["content-type"]?.toLowerCase() ?? "";
            if (type.includes("json") || type.includes("multipart") || type.includes("octet-stream")) {
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
