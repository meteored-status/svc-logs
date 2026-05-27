import tracer, {type Span} from "dd-trace";
import {formats} from "dd-trace/ext";
import type {Server} from "node:http";
import {type RawData, WebSocketServer, type WebSocket as WS} from "ws";

import {Deferred, PromiseTimeout, PromiseTimeoutError} from "services-comun/modules/utiles/promise";

import type {IMessageClient, IMessageServerKO, IMessageServerOK} from "../../metadata/websocket/message";
import {type IWSHandler, WSHandler} from "./handler";

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
 * @property timestamp - Marca de tiempo (ms desde epoch) del último mensaje recibido del cliente.
 * @property timer - Referencia al intervalo/timeout de liveness activo para este cliente.
 * @property client - Socket WebSocket asociado al cliente.
 * @property pendingBuffer - Promesa diferida que se resuelve cuando llega el fragmento binario
 *   (ArrayBuffer) esperado tras un mensaje que declaró `buffer: true`.
 * @property traceContext - Span del upgrade HTTP capturado en el momento de la conexión.
 *   Se usa como padre de cada span de mensaje WebSocket cuando el cliente no propaga contexto propio.
 * @property activeRequests - Número de handlers actualmente en vuelo para esta conexión.
 *   Se compara con {@link WebSocket.MAX_CONCURRENT_REQUESTS} para limitar la concurrencia
 *   y proteger el servidor frente a inundaciones de peticiones.
 */
interface IClientMap {
    timestamp: number;
    timer?: NodeJS.Timeout;
    client: WS;
    pendingBuffer?: Deferred<ArrayBuffer|undefined>;
    traceContext: Span | null;
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
 *    conexión no supere {@link MAX_LIVENESS_MS}.
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

    /** Tiempo máximo de vida de una conexión antes de iniciar el shutdown (ms). */
    private static readonly MAX_LIVENESS_MS = 540000;

    /** Tiempo de espera para que el cliente cierre limpiamente tras recibir el shutdown (ms). */
    private static readonly MAX_SHUTDOWN_MS = 5000;

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
        this.draining = false;
        this.server = new WebSocketServer({ server: http });
        this.addHandlers(handlers);

        this.server.on('connection', (ws: WS) => {
            // Rechazar nuevas conexiones durante el shutdown
            if (this.draining) {
                ws.close(1001, "Server shutting down");
                return;
            }

            const cliente = {
                timestamp: Date.now(),
                traceContext: tracer.scope().active(),
                activeRequests: 0,
                timer: setInterval(()=>{
                    if ((Date.now()-cliente.timestamp)<WebSocket.MAX_LIVENESS_MS) {
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
                .then(async (buffer)=>this.handleRequest(ws, data, cliente.traceContext, buffer))
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
     * @param traceContext - Span del upgrade HTTP usado como padre fallback si el cliente no propaga contexto.
     * @param buffer - Buffer binario opcional asociado al mensaje.
     * @returns Promesa que se resuelve cuando el handler completa su ejecución,
     *   o se rechaza si el handler lanza una excepción o no existe handler para el método.
     */
    private async handleRequest(ws: WS, data: IMessageClient, traceContext: Span | null, buffer?: ArrayBuffer): Promise<void> {
        // Preferir el contexto propagado por el cliente sobre el del upgrade HTTP,
        // para enlazar la traza del servidor con la del cliente como traza distribuida.
        const parentContext = data._datadog
            ? tracer.extract(formats.TEXT_MAP, data._datadog)
            : traceContext;

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
                const handler = this.handlers[data.method];
                if (!handler) {
                    await Promise.reject(new Error(`No handler for method ${data.method}`));
                }

                const timeoutMs = handler.timeoutMs ?? WebSocket.HANDLER_TIMEOUT_MS;
                const wsHandler = new WSHandler(ws, data.id, data.method, buffer, data.head);

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
     * 2. Envía `"Shutdown"` a todos los clientes activos y les da {@link MAX_SHUTDOWN_MS}
     *    para cerrar limpiamente.
     * 3. Espera hasta `timeoutMs` ms a que todos los clientes se desconecten.
     *    Si el tiempo se agota, fuerza el cierre con `terminate()`.
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

        // Notificar a todos los clientes y programar cierre forzado si no responden
        for (const [ws, cliente] of this.clientes) {
            if (cliente.timer) {
                clearInterval(cliente.timer);
                delete cliente.timer;
            }
            if (ws.readyState === ws.OPEN) {
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
            }
        }

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
     * Permite una arquitectura modular en la que diferentes módulos registran sus
     * handlers de forma independiente tras la inicialización inicial.
     *
     * @param handlers - Lista de handlers adicionales a registrar.
     */
    public addHandlers(handlers: IWSHandler[]): void {
        for (const handler of handlers) {
            for (const method of handler.method) {
                this.handlers[method] = handler;
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
export type {WebSocket};
