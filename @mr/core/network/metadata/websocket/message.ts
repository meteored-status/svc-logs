/**
 * Base común para todos los mensajes del protocolo WebSocket.
 * Permite correlacionar cada petición con su respuesta mediante un identificador único.
 * @property id - Identificador único del mensaje, compartido entre petición y respuesta.
 */
interface IMessage {
    id: string;
}

/**
 * Mensaje enviado por el cliente al servidor.
 * @template T - Tipo de los parámetros opcionales de la petición.
 * @property method - Nombre del método/acción que el servidor debe ejecutar.
 * @property buffer - `true` si el cliente enviará un frame binario (ArrayBuffer) inmediatamente
 *   después de este mensaje JSON. El servidor esperará dicho frame antes de invocar al handler.
 * @property head - `true` cuando el cliente no espera ninguna respuesta (fire-and-forget).
 *   El servidor invocará el handler normalmente pero ignorará cualquier llamada a
 *   {@link WSHandler.sendRespuesta} o {@link WSHandler.sendError}: no se envía nada al cliente.
 * @property params - Parámetros opcionales asociados a la petición.
 * @property _datadog - Contexto de traza de Datadog inyectado por el cliente (formato TEXT_MAP).
 *   Permite al servidor continuar la traza distribuida como span hijo del cliente.
 */
export interface IMessageClient<T=any> extends IMessage {
    method: string;
    buffer: boolean;
    head?: boolean;
    params?: T;
    _datadog?: Record<string, string>;
}

/**
 * Metadatos opcionales que el servidor puede adjuntar a una respuesta exitosa.
 * @property expires - Timestamp Unix (segundos) hasta el que la respuesta puede considerarse válida.
 *   Útil para que el cliente implemente caché.
 */
export interface IMetadata {
    expires?: number;
}

/**
 * Base común para los mensajes de respuesta del servidor.
 * Extiende {@link IMessage} añadiendo el indicador de éxito/error.
 * @property ok - `true` si la operación fue exitosa, `false` en caso de error.
 */
interface IMessageServer extends IMessage {
    ok: boolean;
}

/**
 * Respuesta exitosa del servidor al cliente.
 * @template T - Tipo del payload de datos devuelto.
 * @property buffer - `true` si la respuesta incluye un frame binario adicional tras este mensaje JSON.
 *   En ese caso, `data` puede ser `undefined` si el handler no incluye datos JSON junto al frame binario.
 * @property metadata - Metadatos opcionales de la respuesta (p. ej. expiración de caché).
 * @property done - `false` en fragmentos intermedios de un stream; `true` en el último.
 *   Permite implementar respuestas en streaming enviando varios mensajes con `done: false`
 *   y finalizando con `done: true`.
 * @property data - Payload de la respuesta. Puede ser `undefined` cuando `buffer: true` y
 *   el handler no adjunta datos JSON al frame binario.
 */
export interface IMessageServerOK<T=any> extends IMessageServer {
    ok: true;
    buffer: boolean;
    metadata?: IMetadata;
    done: boolean;
    data: T;
}

/**
 * Respuesta de error del servidor al cliente.
 * @property info.message - Descripción legible del error.
 * @property info.extra - Datos adicionales opcionales (traza, código de error, contexto, etc.).
 */
export interface IMessageServerKO extends IMessageServer {
    ok: false;
    info: {
        message: string;
        extra?: unknown;
    };
}

/**
 * Unión discriminada que representa cualquier respuesta posible del servidor.
 * Usar la propiedad `ok` como discriminante para distinguir entre
 * {@link IMessageServerOK} e {@link IMessageServerKO}.
 * @template T - Tipo del payload en caso de respuesta exitosa.
 */
export type MessageServer<T=any> = IMessageServerOK<T> | IMessageServerKO;

/**
 * Par (mensaje JSON + frame binario opcional) que el generator de {@link WSPool} produce
 * por cada respuesta del servidor.
 *
 * Cuando {@link IMessageServerOK.buffer} es `true`, el servidor ha enviado un frame binario
 * inmediatamente después del mensaje JSON; dicho frame se recoge aquí en {@link buffer}.
 * @property message - Mensaje de respuesta del servidor (exitoso o de error).
 * @property buffer - Frame binario opcional recibido tras el mensaje JSON.
 */
export interface IStreamFrame {
    message: MessageServer;
    buffer?: ArrayBuffer;
}

