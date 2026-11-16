/**
 * Editor: Bixus
 * Fecha: Fri, 13 Nov 2026 08:17:27 GMT
 * Hash: 5e7edc16742b3a5efd7eaa273bcd8dbc
 * Versión: 2026.11.13+1-bixus
 * Anterior: 2026.9.23+1-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

import type {IncomingMessage} from "node:http";
import {WebSocket} from "ws";

import type {IMessageServerKO, IMessageServerOK, IMetadata} from "../../metadata/websocket/message";

/**
 * Interfaz que deben implementar los manejadores de mensajes WebSocket.
 * Cada handler se encarga de procesar uno o varios métodos entrantes.
 * @property method - Lista de métodos (acciones) que este handler es capaz de procesar.
 * @property ruta - Path exacto del upgrade al que pertenece este handler (p. ej. `"/status/external/heartbeat/"`;
 *   con o sin barra final es equivalente, se normaliza). Si se omite, el handler es **global**: atiende a las
 *   conexiones de cualquier ruta que no esté reservada por otros handlers. Si se indica, solo atiende a las
 *   conexiones que han hecho el upgrade a esa ruta, y esas conexiones solo resuelven los métodos de los
 *   handlers de esa ruta (nunca los globales).
 * @property autorizar - Comprobación del handshake para la `ruta` del handler. Recibe la petición de upgrade
 *   y decide si la conexión se acepta; si devuelve `false` (o rechaza) el handshake termina con `401` y el
 *   socket no llega a abrirse. Se evalúa una sola vez por conexión, no por mensaje. Si varios handlers de
 *   la misma ruta la declaran, tienen que autorizar todos. Sin efecto si no hay `ruta`.
 * @property timeoutMs - Timeout de ejecución (ms) específico para este handler. Si se omite,
 *   el servidor aplica su valor por defecto (`HANDLER_TIMEOUT_MS`). Útil para handlers
 *   que realizan operaciones costosas (p. ej. generación de informes) y necesitan más tiempo.
 * @property handler - Lógica principal del handler.
 *   @param handler.ws - Instancia de {@link WSHandler} que envuelve la conexión activa.
 *   @param handler.params - Parámetros recibidos junto con el mensaje.
 */
export interface IWSHandler {
    method: string[];
    ruta?: string;
    timeoutMs?: number;
    autorizar?(req: IncomingMessage): boolean|Promise<boolean>;
    handler<T>(ws: WSHandler, params: T): Promise<void>;
}

/**
 * Carga útil de una respuesta exitosa del handler.
 * - Si `buffer` está ausente o es `undefined`, se envía únicamente el mensaje JSON.
 * - Si `buffer` tiene valor, el mensaje JSON se envía con `buffer: true` y el
 *   `ArrayBuffer` se transmite como frame binario inmediatamente después.
 * @template T - Tipo del payload de datos JSON.
 * @property data - Carga útil JSON de la respuesta.
 * @property buffer - Frame binario opcional enviado tras el mensaje JSON.
 */
export interface IHandlerRespuesta<T> {
    data: T;
    buffer?: ArrayBuffer;
}

/**
 * Normaliza el path de una ruta de upgrade: sin query string y con barra final, de modo que
 * `"/a/b"` y `"/a/b/"` son la misma ruta.
 *
 * @param ruta - Path o URL relativa (`req.url`).
 */
export function normalizarRuta(ruta: string): string {
    const path = new URL(ruta, "http://localhost").pathname;

    return path.endsWith("/") ? path : `${path}/`;
}

/**
 * Datos opcionales de un {@link WSHandler}.
 *
 * @property buffer - Datos binarios opcionales adjuntos al mensaje.
 * @property head - Si `true`, el cliente no espera respuesta (fire-and-forget). Cualquier llamada
 *   a {@link WSHandler.sendRespuesta} o {@link WSHandler.sendError} será silenciada.
 * @property ruta - Ruta (normalizada) a la que hizo el upgrade la conexión; `undefined` si no está ligada a ninguna.
 * @property request - Petición HTTP del upgrade (cabeceras, IP de origen…).
 */
export interface IWSHandlerConfig {
    buffer?: ArrayBuffer;
    head?: boolean;
    ruta?: string;
    request?: IncomingMessage;
}

/**
 * Par (mensaje JSON + frame binario opcional) pendiente de envío en la cola saliente
 * de {@link WSHandler}.
 */
interface IOutQueueItem {
    json: string;
    buffer?: ArrayBuffer;
}

/**
 * Clase auxiliar que encapsula una conexión WebSocket activa junto con los
 * metadatos del mensaje recibido. Expone métodos de conveniencia para enviar
 * respuestas al cliente de forma estructurada.
 *
 * ### Backpressure transparente
 * Los mensajes enviados con {@link sendRespuesta} y {@link sendError} no se
 * transmiten directamente: se encolan en una cola FIFO interna. Un bucle de
 * drenado (`drainLoop`) los procesa en orden y espera automáticamente al evento
 * `drain` del socket cuando el buffer de salida supera {@link BACKPRESSURE_THRESHOLD},
 * evitando que streams rápidos saturen la memoria del servidor. El handler no
 * necesita ser consciente de este mecanismo.
 */
export class WSHandler {
    /* STATIC */

    /**
     * Umbral de bytes en el buffer de envío a partir del cual el {@link drainLoop}
     * espera al evento `drain` del socket antes de enviar el siguiente frame.
     */
    private static readonly BACKPRESSURE_THRESHOLD = 64 * 1024; // 64 KB

    /* INSTANCE */

    /** Datos binarios adjuntos al mensaje, si los hay. */
    public readonly buffer: ArrayBuffer|undefined;

    /** Ruta (normalizada) del upgrade de la conexión; `undefined` si no está ligada a ninguna. */
    public readonly ruta: string|undefined;

    /** Petición HTTP del upgrade de la conexión (cabeceras, IP de origen…). */
    public readonly request: IncomingMessage|undefined;

    /** `true` si el cliente no espera respuesta (fire-and-forget). */
    private readonly head: boolean;

    /** Cola FIFO de frames pendientes de envío al cliente. */
    private readonly outQueue: IOutQueueItem[];

    /** `true` mientras el {@link drainLoop} está activo procesando la cola. */
    private draining: boolean;

    /**
     * `true` cuando ya se ha encolado una respuesta terminal (`sendRespuesta` con `done=true`
     * o `sendError`). Permite al servidor detectar si debe enviar un error automático cuando
     * el handler lanza una excepción después de haber respondido parcialmente.
     */
    private done: boolean;

    /**
     * `true` cuando ya se ha enviado una respuesta terminal al cliente
     * (`sendRespuesta` con `done=true` o `sendError`).
     * El servidor lo usa para evitar enviar un error adicional si el handler
     * lanza una excepción pero ya completó su respuesta.
     */
    public get isDone(): boolean {
        return this.done;
    }

    /**
     * Crea una nueva instancia de WSHandler.
     * @param ws - Socket WebSocket subyacente sobre el que se enviarán las respuestas.
     * @param id - Identificador único del mensaje, utilizado para correlacionar petición y respuesta.
     * @param method - Nombre del method/acción solicitado por el cliente.
     * @param config - Datos opcionales del mensaje ({@link IWSHandlerConfig}).
     */
    public constructor(private readonly ws: WebSocket, private readonly id: string, public readonly method: string, {buffer, head = false, ruta, request}: IWSHandlerConfig = {}) {
        this.buffer = buffer;
        this.head = head;
        this.ruta = ruta;
        this.request = request;
        this.outQueue = [];
        this.draining = false;
        this.done = false;
    }

    /**
     * Envía una respuesta exitosa al cliente.
     * El frame se encola y se transmite de forma asíncrona con control de backpressure.
     * Si la petición fue de tipo `head` (fire-and-forget), esta llamada es un no-op.
     * @param data - Carga útil de la respuesta ({@link IHandlerRespuesta}).
     *   Si `data.buffer` tiene valor, el mensaje JSON se envía con `buffer: true`
     *   y el `ArrayBuffer` se transmite como frame binario separado a continuación.
     * @param metadata - Metadatos opcionales que acompañan a la respuesta (p. ej. expiración de caché).
     * @param done - Indica si es el último fragmento de la respuesta. Por defecto `true`.
     */
    public sendRespuesta<T>(data: IHandlerRespuesta<T>, metadata?: IMetadata, done=true): void {
        if (this.head) {
            return;
        }
        if (done) {
            this.done = true;
        }
        this.enqueue(
            JSON.stringify({
                id: this.id,
                ok: true,
                buffer: data.buffer !== undefined,
                metadata,
                done,
                data: data.data,
            } as IMessageServerOK<T>),
            data.buffer,
        );
    }

    /**
     * Envía una respuesta de error al cliente.
     * El frame se encola y se transmite de forma asíncrona con control de backpressure.
     * Si la petición fue de tipo `head` (fire-and-forget), esta llamada es un no-op.
     * @param message - Mensaje descriptivo del error ocurrido.
     * @param extra - Información adicional opcional (traza, código de error, etc.).
     */
    public sendError(message: string, extra?: unknown): void {
        if (this.head) {
            return;
        }
        this.done = true;
        this.enqueue(JSON.stringify({
            id: this.id,
            ok: false,
            info: {
                message,
                extra,
            },
        } as IMessageServerKO));
    }

    /**
     * Añade un item a la cola de salida y arranca el bucle de drenado si no está ya activo.
     * @param json - Mensaje JSON serializado.
     * @param buffer - Frame binario opcional que se enviará inmediatamente tras el JSON.
     */
    private enqueue(json: string, buffer?: ArrayBuffer): void {
        this.outQueue.push({ json, buffer });
        if (!this.draining) {
            this.draining = true;
            this.drainLoop().catch(() => undefined);
        }
    }

    /**
     * Procesa la cola de salida en orden FIFO.
     *
     * Antes de enviar cada item comprueba si el buffer de salida del socket supera
     * {@link BACKPRESSURE_THRESHOLD}. Si es así, espera al evento `drain` del socket
     * antes de continuar. Si la conexión se cierra o produce un error durante la espera,
     * la cola se vacía y el bucle termina.
     */
    private async drainLoop(): Promise<void> {
        try {
            while (this.outQueue.length > 0) {
                if (this.ws.bufferedAmount > WSHandler.BACKPRESSURE_THRESHOLD) {
                    try {
                        await this.waitForDrain();
                    } catch {
                        // Conexión cerrada o error: descartar la cola y salir
                        this.outQueue.length = 0;
                        break;
                    }
                }

                const item = this.outQueue.shift()!;
                if (this.ws.readyState === WebSocket.OPEN) {
                    this.ws.send(item.json);
                    if (item.buffer) {
                        this.ws.send(item.buffer);
                    }
                }
            }
        } finally {
            // Garantizar el reset del flag incluso si ws.send() lanza una excepción inesperada
            this.draining = false;
        }
    }

    /**
     * Devuelve una promesa que se resuelve cuando el socket emite `drain`
     * (buffer vaciado) o se rechaza si la conexión se cierra o produce un error.
     */
    private waitForDrain(): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            const cleanup = (cb: () => void) => {
                this.ws.off("drain", onDrain);
                this.ws.off("error", onError);
                this.ws.off("close", onClose);
                cb();
            };
            const onDrain = () => cleanup(resolve);
            const onError = (err: Error) => cleanup(() => reject(err));
            const onClose = () => cleanup(() => reject(new Error("Connection closed during drain")));
            this.ws.once("drain", onDrain);
            this.ws.once("error", onError);
            this.ws.once("close", onClose);
        });
    }
}
