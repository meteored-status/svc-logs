import {ErrorCode} from "../interface";
import {RequestError} from "../error";
import type {Parser} from "../parser";
import type {Respuesta} from "../respuesta";

/**
 * Métodos HTTP soportados por las clases de petición de este módulo.
 */
export const enum RequestMethod {
    GET    = "GET",
    HEAD   = "HEAD",
    PATCH  = "PATCH",
    POST   = "POST",
    PUT    = "PUT",
    DELETE = "DELETE",
}

/**
 * Configuración de una petición HTTP.
 *
 * @property method              - Método HTTP de la petición.
 * @property auth                - Valor del encabezado `Authorization` (p. ej. `"Bearer <token>"`).
 * @property contentType         - Valor del encabezado `Content-Type`. Si se omite en peticiones
 *   con cuerpo, se usa `application/json` por defecto.
 * @property dominioAlternativo  - Dominio de fallback al que redirigir la petición cuando falla
 *   en `localhost` durante el desarrollo. Solo se aplica fuera de producción.
 * @property headers             - Encabezados personalizados iniciales de la petición.
 * @property traceparent         - Cabecera W3C Trace Context (`traceparent`) para propagar
 *   el contexto de trazabilidad Datadog entre servicios.
 */
export interface IRequestConfig {
    auth?: string;
    contentType?: string;
    dominioAlternativo?: string;
    headers?: Headers;
    method: RequestMethod;
    traceparent?: string;
}

/**
 * Clase base abstracta para todas las peticiones HTTP del módulo.
 *
 * Gestiona la construcción de encabezados, la ejecución de la petición con `fetch`,
 * la normalización de errores a {@link RequestError} y el fallback a un dominio
 * alternativo en entornos de desarrollo cuando la petición a `localhost` falla.
 *
 * Las subclases concretas (`PeticionGET`, `PeticionPOST`, etc.) se instancian únicamente
 * a través de su método estático `run()` — el constructor es `protected`.
 *
 * @property urlOriginal - URL original con la que se construyó la petición.
 * @property url         - URL activa de la petición. Puede diferir de `urlOriginal` si
 *   se aplicó el fallback al dominio alternativo.
 * @property headers     - Encabezados que se enviarán con la petición.
 */
export abstract class Peticion {
    /* INSTANCE */
    protected readonly headers: Headers;
    protected url: string;

    private responseHeaders?: Headers;

    protected constructor(public readonly urlOriginal: string, protected cfg: IRequestConfig) {
        this.headers = cfg.headers ?? new Headers();
        this.url = urlOriginal;
    }

    /**
     * Construye el objeto `RequestInit` que se pasará a `fetch`.
     *
     * Las subclases deben sobreescribir este método para añadir cuerpo, cabeceras
     * adicionales o cualquier otra opción específica del método HTTP. Deben llamar
     * a `super.init()` para obtener la base y extenderla.
     *
     * Puede rechazar la promesa con `Promise.reject()` si la configuración no es válida,
     * en cuyo caso `run()` propagará el rechazo sin llegar a ejecutar el `fetch`.
     *
     * @returns Promesa que se resuelve con el objeto de configuración de la petición.
     */
    protected async init(): Promise<RequestInit> {
        return {
            method: this.cfg.method,
            headers: this.headers,
        };
    }

    private setHeaders(): void {
        if (this.cfg.auth) {
            this.headers.set("Authorization", this.cfg.auth);
        }
        if (this.cfg.traceparent) {
            this.headers.set("traceparent", this.cfg.traceparent);
        }
    }

    /**
     * Ejecuta la petición HTTP contra `this.url` usando el parser indicado.
     *
     * Aplica los encabezados de autenticación y trazabilidad, llama a `fetch` con
     * el resultado de `init()` y delega el parseo de la respuesta a `parser`.
     * Si la petición falla, intenta el fallback al dominio alternativo en desarrollo.
     *
     * Las subclases no sobreescriben este método; lo invocan desde su `run()` estático.
     *
     * @param parser - Función que transforma la `Response` HTTP en `Respuesta<T>`.
     * @returns Promesa que se resuelve con la respuesta parseada o rechaza con {@link RequestError}.
     */
    protected async run<T>(parser: Parser<T>): Promise<Respuesta<T>> {
        this.setHeaders();

        try {
            const respuesta = await fetch(this.url, await this.init());
            this.responseHeaders = respuesta.headers;

            return await parser(respuesta);
        } catch (e) {
            return this.tratarError(this.checkError(e), parser);
        }
    }

    private async tratarError<T>(err: RequestError, parser: Parser<T>): Promise<Respuesta<T>> {
        // Solo en desarrollo, cuando la petición a localhost falla por red, se reintenta
        // contra el dominio alternativo (https). Tras el cambio de URL, la siguiente llamada
        // a run() no volverá a entrar aquí porque la URL ya no empieza por "http://localhost:".
        if (PRODUCCION || err.code !== ErrorCode.NETWORK || !this.url.startsWith("http://localhost:") || !this.cfg.dominioAlternativo) {
            return Promise.reject(err);
        }

        const url = new URL(this.url);
        url.protocol = "https:";
        url.hostname = this.cfg.dominioAlternativo;
        url.port = "";
        this.url = url.toString();

        return this.run(parser);
    }

    private checkError(e: unknown): RequestError {
        if (e instanceof RequestError) {
            return e;
        }

        return new RequestError({
            status: 0,
            url: this.url,
            headers: this.responseHeaders??new Headers(),
            code: ErrorCode.NETWORK,
            message: e instanceof TypeError ? e.message : "Error desconocido",
            extra: e,
        });

    }
}
