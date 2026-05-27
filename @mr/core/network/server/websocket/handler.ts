import {WebSocket} from "ws";

import type {IMessageServerKO, IMessageServerOK, IMetadata} from "../../metadata/websocket/message";

/**
 * Interfaz que deben implementar los manejadores de mensajes WebSocket.
 * Cada handler se encarga de procesar uno o varios métodos entrantes.
 * @property method - Lista de métodos (acciones) que este handler es capaz de procesar.
 * @property timeoutMs - Timeout de ejecución (ms) específico para este handler. Si se omite,
 *   el servidor aplica su valor por defecto (`HANDLER_TIMEOUT_MS`). Útil para handlers
 *   que realizan operaciones costosas (p. ej. generación de informes) y necesitan más tiempo.
 * @property handler - Lógica principal del handler.
 *   @param handler.ws - Instancia de {@link WSHandler} que envuelve la conexión activa.
 *   @param handler.params - Parámetros recibidos junto con el mensaje.
 */
export interface IWSHandler {
    method: string[];
    timeoutMs?: number;
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
    /**
     * Umbral de bytes en el buffer de envío a partir del cual el {@link drainLoop}
     * espera al evento `drain` del socket antes de enviar el siguiente frame.
     */
    private static readonly BACKPRESSURE_THRESHOLD = 64 * 1024; // 64 KB

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
     * @param buffer - Datos binarios opcionales adjuntos al mensaje.
     * @param head - Si `true`, el cliente no espera respuesta (fire-and-forget). Cualquier llamada
     *   a {@link sendRespuesta} o {@link sendError} será silenciada.
     */
    public constructor(
        private readonly ws: WebSocket,
        private readonly id: string,
        public readonly method: string,
        public readonly buffer?: ArrayBuffer,
        private readonly head: boolean = false,
    ) {
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
