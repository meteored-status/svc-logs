import {ErrorCode} from "../../interface";
import {RequestError} from "../error";
import type {Parser} from "../parser";
import type {Respuesta} from "../respuesta";

export const enum RequestMethod {
    GET    = "GET",
    HEAD   = "HEAD",
    PATCH  = "PATCH",
    POST   = "POST",
    PUT    = "PUT",
    DELETE = "DELETE",
}

// export interface IRequest {
//     x_u_email?: string;
//     timeout: number;
//     retry: number;
//     retryOnTimeout: boolean; // si es true, se reintentará la petición si se produce un timeout del servidor (no del campo tiemout).
//     buffer: boolean;
// }
export interface IRequestConfig {
    auth?: string;
    contentType?: string;
    dominioAlternativo?: string;
    headers?: Headers;
    method: RequestMethod;
    traceparent?: string;
}

export abstract class Peticion {
    /* INSTANCE */
    public readonly headers: Headers;
    public url: string;

    private responseHeaders?: Headers;

    protected constructor(public readonly urlOriginal: string, protected cfg: IRequestConfig) {
        this.headers = cfg.headers ?? new Headers();
        this.url = urlOriginal;
    }

    protected init(): RequestInit {
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

    protected async run<T>(parser: Parser<T>): Promise<Respuesta<T>> {
        this.setHeaders();

        try {
            const respuesta = await fetch(this.url, this.init());
            this.responseHeaders = respuesta.headers;

            return await parser(respuesta);
        } catch (e) {
            return this.tratarError(this.checkError(e), parser);
        }
    }

    private async tratarError<T>(err: RequestError, parser: Parser<T>): Promise<Respuesta<T>> {
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

    private checkError(e: RequestError|any): RequestError {
        // if (RequestError.check(e)) {
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
