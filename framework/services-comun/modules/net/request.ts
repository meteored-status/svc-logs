import {ErrorCode, IErrorInfo, IRespuesta} from "./interface";
import {PromiseDelayed} from "../utiles/promise";

export interface RequestResponse<T=any> {
    data: T;
    headers: Headers;
    expires?: Date;
}

export interface IRequest {
    auth?: string;
    x_u_email?: string;
    timeout: number;
    retry: number;
    retryOnTimeout: boolean; // si es true, se reintentará la petición si se produce un timeout del servidor (no del campo tiemout).
    buffer: boolean;
    traceparent?: string;
    contentType?: string;
    dominioAlternativo?: string;
}

export interface IRequestConfig extends Partial<IRequest> {}

export interface IRequestError extends IErrorInfo {
    url: string;
    headers: Headers;
}

export class RequestError extends Error {
    /* STATIC */
    public static check(err: any): boolean {
        // en browser la primera parte no se cumple
        return err instanceof RequestError  || ("url" in err && "headers" in err && "code" in err && "message" in err);
    }

    public static instanceof(err: any): RequestError|null {
        return this.check(err) ? err : null;
    }

    /* INSTANCE */
    public readonly url: string;
    public readonly headers: Headers;
    public readonly code: ErrorCode;
    public readonly extra?: any;

    public constructor(info: IRequestError) {
        super(info.message);

        this.url = info.url;
        this.headers = info.headers;
        this.code = info.code;
        this.extra = info.extra;
    }

    public override toString(): string {
        return `${this.code}: ${this.message}`;
    }
}

export class Request {
    /* STATIC */
    protected static parseConfig(cfg?: IRequestConfig): IRequest {
        return {
            timeout: 1000,
            retry: 0,
            retryOnTimeout: true,
            buffer: false,
            ...cfg,
        };
    }

    protected static async parseRespuestaBuffer(respuesta: Response): Promise<RequestResponse<Buffer>> {
        const expires = respuesta.headers.get("expires");
        return {
            data: Buffer.from(await respuesta.arrayBuffer()),
            headers: respuesta.headers,
            expires: expires!=null?new Date(expires):undefined,
        };
    }

    protected static async checkRespuesta<T>(data: IRespuesta<T>, headers: Headers, url: string): Promise<RequestResponse<T>> {
        if (data.ok) {
            return {
                data: data.data,
                headers,
                expires: new Date(data.expiracion),
            };
        }

        return Promise.reject(new RequestError({
            url,
            headers,
            ...data.info,
        }));
    }

    protected static async parseRespuestaJSON<T>(respuesta: Response, url: string): Promise<RequestResponse<T>> {
        const data: IRespuesta<T> = await respuesta.json();

        return await this.checkRespuesta<T>(data, respuesta.headers, url);
        // if (data.ok) {
        //     return {
        //         data: data.data,
        //         headers: respuesta.headers,
        //         expires: new Date(data.expiracion),
        //     };
        // }
        //
        // return Promise.reject(new RequestError({
        //     url,
        //     ...data.info,
        // }));
    }

    protected static async parseRespuesta<T>(respuesta: Response, config: IRequestConfig, url: string): Promise<RequestResponse<T>> {
        if (respuesta.ok) {
            if (!config.buffer) {
                return await this.parseRespuestaJSON<T>(respuesta, url);
            }
            return await this.parseRespuestaBuffer(respuesta) as RequestResponse<T>;
        }

        // SI EL CÓDIGO NO ES 200 ENTONCES VA A SALTAR AQUÍ
        return Promise.reject(new RequestError({
            url,
            headers: respuesta.headers,
            code: ErrorCode.NETWORK,
            message: respuesta.statusText,
        }));
    }

    protected static async fetch<T, K=undefined>(url: string, init: RequestInit, headers: Headers, cfg: IRequestConfig, post?: K, retry: number = 0): Promise<RequestResponse<T>> {
        const config = this.parseConfig(cfg);
        let timeoutID: NodeJS.Timeout|undefined;
        let abortado = false;
        if (cfg.timeout!=undefined) {
            const timeout = new AbortController();
            timeoutID = setTimeout(() => {
                timeout.abort();
                abortado = true;
                timeoutID = undefined;
            }, cfg.timeout);
            init.signal = timeout.signal;
            // init.signal = AbortSignal.timeout(cfg.timeout);
        }

        if (config.auth!=undefined && !headers.has("Authorization")) {
            headers.set("Authorization", config.auth);
        }
        if (config.x_u_email!=undefined && !headers.has("x-u-email")) {
            headers.set("x-u-email", config.x_u_email);
        }
        if (config.traceparent && !headers.has("traceparent")) {
            headers.set("traceparent", config.traceparent);
        }
        if (post!=undefined) {
            init.method = "POST";
            init.cache = "no-cache";
            if (!headers.has("Content-Type")) {
                if (cfg.contentType!=undefined) {
                    headers.set("Content-Type", cfg.contentType);
                } else {
                    headers.set("Content-Type", "application/json");
                }
            }
            switch(headers.get("Content-Type")) {
                case "application/json":
                    init.body = JSON.stringify(post);
                    break;
                case "text/plain":
                    init.body = String(post);
                    break;
            }
        }

        try {
            const respuesta = await fetch(url, {
                ...init,
                headers,
            });
            if (timeoutID!=undefined) {
                clearTimeout(timeoutID);
            }
            return await this.parseRespuesta(respuesta, config, url);
        } catch (e) {
            if (RequestError.check(e)) {
                return Promise.reject(e);
            }

            if (abortado) {
                return Promise.reject(new RequestError({
                    url,
                    headers,
                    code: ErrorCode.TIMEOUT,
                    message: `${url} => "Timeout tras ${cfg.timeout}ms"`,
                    extra: e,
                }));
            }

            if (PRODUCCION && cfg.retryOnTimeout && retry<10) {
                retry++;
                await PromiseDelayed(retry*1000);
                return this.fetch<T, K>(url, init, headers, cfg, post, retry);
            }

            if (e instanceof TypeError) {
                return Promise.reject(new RequestError({
                    url,
                    headers,
                    code: ErrorCode.NETWORK,
                    message: `${url} => "${e.message}"`,
                    extra: e,
                }));
            }

            return Promise.reject(new RequestError({
                url,
                headers,
                code: ErrorCode.NETWORK,
                message: `${url} => "Error desconocido"`,
                extra: e,
            }));
        }
    }

    protected static async get<T=undefined>(url: string, cfg: IRequestConfig={}): Promise<RequestResponse<T>> {
        return this.fetch<T>(url, {}, new Headers(), cfg);
    }

    /* INSTANCE */
}
