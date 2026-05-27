/**
 * Editor: José Antonio Jiménez
 * Fecha: Mon, 18 May 2026 10:42:05 GMT
 * Hash: a5b06b3f76f40580fbf06ab2ff3d2c92
 * Versión: 2026.5.18+2-josantoniojimnez
 */

import {Conexion} from "./conexion";

/**
 * Códigos de estado HTTP representados por las clases de error de este módulo.
 */
export type TStatus = 301 | 404 | 410 | 500;

/**
 * Clase base abstracta para errores HTTP tipados.
 *
 * Cada subclase representa un código de estado HTTP concreto e implementa
 * {@link sendRespuesta} para enviar la respuesta adecuada al cliente mediante
 * la {@link Conexion} activa.
 */
export abstract class HttpError {

    /** Código de estado HTTP asociado a este error. */
    public readonly status: TStatus;

    protected constructor(status: TStatus) {
        this.status = status;
    }

    /**
     * Envía la respuesta HTTP correspondiente al error al cliente.
     * @param conexion - Conexión HTTP activa sobre la que enviar la respuesta.
     * @returns Código de estado HTTP efectivamente enviado.
     */
    public abstract sendRespuesta(conexion: Conexion): Promise<number>;
}

/**
 * Clase intermedia para errores HTTP que comparten la estructura
 * `mensaje + extra` y delegan en `conexion.error(status, mensaje, extra)`.
 *
 * Sirve de base para {@link HttpError404}, {@link HttpError410} y {@link HttpError500}
 * sin que ninguno tenga que extender de otro hermano (anti-patrón Liskov anterior).
 */
export abstract class HttpErrorMensaje extends HttpError {

    /** Mensaje descriptivo del error. */
    public readonly message: string;

    /** Información adicional opcional adjunta al error. */
    public readonly extra?: unknown;

    protected constructor(status: TStatus, message: string, extra?: unknown) {
        super(status);
        this.message = message;
        this.extra = extra;
    }

    public async sendRespuesta(conexion: Conexion): Promise<number> {
        return conexion.error(this.status, this.message, this.extra);
    }
}

/**
 * Error HTTP 301 — Redirección permanente.
 * Redirige al cliente a la URL indicada en `location`.
 */
export class HttpError301 extends HttpError {

    /**
     * Crea una redirección permanente hacia la URL indicada.
     * @param location - URL de destino de la redirección.
     */
    public static build(location: string): HttpError301 {
        return new this(location);
    }


    /** URL de destino de la redirección. */
    public readonly location: string;

    protected constructor(location: string) {
        super(301);
        this.location = location;
    }

    public async sendRespuesta(conexion: Conexion): Promise<number> {
        return conexion.send301(this.location);
    }
}

/**
 * Error HTTP 404 — Recurso no encontrado.
 */
export class HttpError404 extends HttpErrorMensaje {

    /**
     * Crea un error 404 con el mensaje e información adicional indicados.
     * @param message - Mensaje descriptivo del error.
     * @param extra   - Información adicional opcional (traza, contexto, etc.).
     */
    public static build(message: string, extra?: unknown): HttpError404 {
        return new this(message, extra);
    }

    protected constructor(message: string, extra?: unknown) {
        super(404, message, extra);
    }
}

/**
 * Error HTTP 410 — Recurso eliminado permanentemente.
 * Indica al cliente que el recurso existió pero ya no está disponible.
 */
export class HttpError410 extends HttpErrorMensaje {

    /**
     * Crea un error 410 con el mensaje e información adicional indicados.
     * @param message - Mensaje descriptivo del error.
     * @param extra   - Información adicional opcional.
     */
    public static build(message: string, extra?: unknown): HttpError410 {
        return new this(message, extra);
    }

    protected constructor(message: string, extra?: unknown) {
        super(410, message, extra);
    }
}

/**
 * Error HTTP 500 — Error interno del servidor.
 * Indica un fallo inesperado en el procesamiento de la petición.
 */
export class HttpError500 extends HttpErrorMensaje {

    /**
     * Crea un error 500 con el mensaje e información adicional indicados.
     * @param message - Mensaje descriptivo del error.
     * @param extra   - Información adicional opcional (traza, contexto, etc.).
     */
    public static build(message: string, extra?: unknown): HttpError500 {
        return new this(message, extra);
    }

    protected constructor(message: string, extra?: unknown) {
        super(500, message, extra);
    }
}
