/**
 * Clasificación del motivo de fallo de una petición HTTP.
 *
 * - `NETWORK`           — error de red o conexión (no se pudo contactar con el servidor).
 * - `TIMEOUT`           — la petición superó el tiempo máximo de espera.
 * - `AUTHENTICATION`    — credenciales inválidas o ausentes (401/403).
 * - `RESPONSE`          — la respuesta del servidor no pudo ser procesada (formato inesperado).
 * - `APPLICATION`       — error de lógica de negocio devuelto por el servidor.
 * - `NO_DATA_TEMPORARY` — el recurso no está disponible temporalmente; puede reintentarse.
 * - `NO_DATA_PERMANENT` — el recurso no existe o ha sido eliminado; no debe reintentarse.
 * - `NO_DATA`           — sin datos, sin indicación de si es temporal o permanente.
 */
export const enum ErrorCode {
    NETWORK           = 1,
    TIMEOUT           = 2,
    AUTHENTICATION    = 3,
    RESPONSE          = 4,
    APPLICATION       = 5,
    NO_DATA_TEMPORARY = 6,
    NO_DATA_PERMANENT = 7,
    NO_DATA           = 8
}

/**
 * Información de error adjunta a una respuesta fallida.
 *
 * @property code    - Clasificación del fallo según {@link ErrorCode}.
 * @property message - Descripción legible del error.
 * @property extra   - Información adicional de contexto adjuntada por el emisor del error.
 */
export interface IErrorInfo {
    code: ErrorCode;
    message: string;
    extra?: unknown;
}

/**
 * Resultado de una operación exitosa con datos y metadatos de caché.
 *
 * @template T - Tipo del dato devuelto.
 *
 * @property expiracion - Fecha a partir de la cual el dato se considera expirado.
 * @property etag       - Identificador de versión del recurso para validación condicional.
 * @property data       - Dato obtenido.
 */
export interface IOK<T> {
    expiracion: Date;
    etag: string;
    data: T;
}

/**
 * Respuesta exitosa del servidor.
 *
 * @template T - Tipo del dato devuelto.
 *
 * @property ok         - Siempre `true`; discriminante de la unión {@link IRespuesta}.
 * @property expiracion - Timestamp Unix (ms) de expiración del dato.
 * @property data       - Dato devuelto por el servidor.
 * @property info       - Información de error opcional adjunta a una respuesta que,
 *   pese a ser exitosa, incluye advertencias o contexto adicional.
 */
export interface IRespuestaOK<T> {
    ok: true;
    expiracion: number;
    data: T;
    info?: IErrorInfo;
}

/**
 * Respuesta de error del servidor.
 *
 * @template T - Tipo del dato opcional que puede acompañar al error.
 *
 * @property ok         - Siempre `false`; discriminante de la unión {@link IRespuesta}.
 * @property expiracion - Timestamp Unix (ms) de expiración. Ausente si el servidor no lo indica.
 * @property data       - Dato parcial opcional que puede acompañar al error.
 * @property info       - Detalle del error devuelto por el servidor.
 */
export interface IRespuestaKO<T=undefined> {
    ok: false;
    expiracion?: number;
    data?: T;
    info: IErrorInfo;
}

/**
 * Unión discriminada de {@link IRespuestaOK} e {@link IRespuestaKO}.
 *
 * El campo `ok` actúa como discriminante: permite al compilador estrechar el tipo
 * con una simple comprobación `if (resp.ok)`.
 *
 * @template T - Tipo del dato en caso de éxito.
 */
export type IRespuesta<T=undefined> = IRespuestaOK<T>|IRespuestaKO<T>;
