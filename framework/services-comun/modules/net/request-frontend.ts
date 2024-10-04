import {ErrorCode, IRespuesta} from "./interface";
import {RequestError} from "./request/error";

export interface IRequest {
    auth?: string;
    x_u_email?: string;
    retry: number;
    retryOnTimeout: boolean; // si es true, se reintentará la petición si se produce un timeout del servidor (no del campo tiemout).
    buffer: boolean;
    traceparent?: string;
    contentType?: string;
    dominioAlternativo?: string;
}
export interface IRequestConfig extends Partial<IRequest> {}

export interface RequestResponse<T=any> {
    data: T;
    headers: Headers;
    expires?: Date;
}

export class FrontendRequest {
    /* STATIC */
    protected static parseConfig(cfg?: IRequestConfig): IRequest {
        return {
            retry: 0,
            retryOnTimeout: true,
            buffer: false,
            ...cfg,
        };
    }

    protected static async fetchGET<T>(url: string, init: RequestInit, headers: Headers, cfg: IRequestConfig): Promise<RequestResponse<T>> {
        const config = this.parseConfig(cfg);

        if (config.auth!=undefined && !headers.has("Authorization")) {
            headers.set("Authorization", config.auth);
        }
        if (config.x_u_email!=undefined && !headers.has("x-u-email")) {
            headers.set("x-u-email", config.x_u_email);
        }
        if (config.traceparent && !headers.has("traceparent")) {
            headers.set("traceparent", config.traceparent);
        }

        try {
            const respuesta = await fetch(url, {
                ...init,
                headers,
            });

            return await this.parseRespuesta(respuesta, config, url);
        } catch (e) {
            if (e instanceof RequestError) {
                return Promise.reject(e);
            }

            if (e instanceof TypeError) {
                return Promise.reject(new RequestError({
                    url,
                    headers,
                    code: ErrorCode.NETWORK,
                    message: `${url} => "${e.message}"`,
                    extra: e,
                    status: 0,
                }));
            }

            return Promise.reject(new RequestError({
                url,
                headers,
                code: ErrorCode.NETWORK,
                message: `${url} => "Error desconocido"`,
                extra: e,
                status: 0,
            }));
        }
    }

    protected static async fetchPOST<T, K=undefined>(url: string, init: RequestInit, headers: Headers, cfg: IRequestConfig, post: K): Promise<RequestResponse<T>> {
        const config = this.parseConfig(cfg);

        if (config.auth!=undefined && !headers.has("Authorization")) {
            headers.set("Authorization", config.auth);
        }
        if (config.x_u_email!=undefined && !headers.has("x-u-email")) {
            headers.set("x-u-email", config.x_u_email);
        }
        if (config.traceparent && !headers.has("traceparent")) {
            headers.set("traceparent", config.traceparent);
        }

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
            case "multipart/form-data":
                init.body = post as FormData;
                headers.delete("Content-Type");
                break;
            case "text/plain":
                init.body = String(post);
                break;
            // case "application/x-www-form-urlencoded":
            //     init.body = String(post);
            //     break;
        }

        try {
            const respuesta = await fetch(url, {
                ...init,
                headers,
            });

            return await this.parseRespuesta(respuesta, config, url);
        } catch (e) {
            if (e instanceof RequestError) {
                return Promise.reject(e);
            }

            if (e instanceof TypeError) {
                return Promise.reject(new RequestError({
                    url,
                    headers,
                    code: ErrorCode.NETWORK,
                    message: `${url} => "${e.message}"`,
                    extra: e,
                    status: 0,

                }));
            }

            return Promise.reject(new RequestError({
                url,
                headers,
                code: ErrorCode.NETWORK,
                message: `${url} => "Error desconocido"`,
                extra: e,
                status: 0,

            }));
        }
    }

    protected static async parseRespuesta<T>(respuesta: Response, config: IRequestConfig, url: string): Promise<RequestResponse<T>> {
        if (respuesta.ok) {
            if (!config.buffer) {
                return await this.parseRespuestaJSON<T>(respuesta, url);
            }
            return await this.parseRespuestaArrayBuffer(respuesta) as RequestResponse<T>;
        }

        // SI EL CÓDIGO NO ES 200 ENTONCES VA A SALTAR AQUÍ
        return Promise.reject(new RequestError({
            url,
            headers: respuesta.headers,
            code: ErrorCode.NETWORK,
            message: respuesta.statusText,
            status: 0,

        }));
    }

    protected static async parseRespuestaJSON<T>(respuesta: Response, url: string): Promise<RequestResponse<T>> {
        const data: IRespuesta<T> = await respuesta.json();

        return await this.checkRespuesta<T>(data, respuesta.headers, url);
    }

    protected static async parseRespuestaArrayBuffer(respuesta: Response): Promise<RequestResponse<ArrayBuffer>> {
        const expires = respuesta.headers.get("expires");
        return {
            data: await respuesta.arrayBuffer(),
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
            status: 0,
        }));
    }

    public static async getBuffer(url: string, cfg: IRequestConfig={}): Promise<RequestResponse<ArrayBuffer>> {
        if (PRODUCCION) {
            return this.fetchGET<ArrayBuffer>(url, {}, new Headers(), {
                buffer: true,
            });
        }

        try {
            return await this.fetchGET<ArrayBuffer>(url, {}, new Headers(), {
                buffer: true,
            });
        } catch (err) {
            if (!url.startsWith("http://localhost:") || cfg.dominioAlternativo==undefined) {
                return Promise.reject(err);
            }

            const partes = url.replace("http://localhost:", "").split("/");
            partes.shift();
            partes.unshift(cfg.dominioAlternativo);
            return this.fetchGET<ArrayBuffer>(partes.join("/"), {}, new Headers(), {
                buffer: true,
            });
        }
    }

    public static async getString(url: string, cfg: IRequestConfig={}): Promise<RequestResponse<string>> {
        const data = await this.getBuffer(url, cfg);
        const textDecoder = new TextDecoder();
        const texto = textDecoder.decode(data.data);
        return {
            ...data,
            data: texto,
        };
    }

    public static async getStringPOST(url: string, data: any, cfg: IRequestConfig={}): Promise<RequestResponse<string>> {
        const dataBuffer = await this.postJSON(url, data, cfg) as RequestResponse<ArrayBuffer>;
        const textDecoder = new TextDecoder();
        const texto = textDecoder.decode(dataBuffer.data);
        return {
            ...dataBuffer,
            data: texto,
        };
    }

    protected static async postJSON<T,S>(url: string, data: S, cfg: IRequestConfig={}): Promise<RequestResponse<T>> {
        return this.fetchPOST<T, S>(url, {}, new Headers(), cfg, data);
    }

    protected static async postFormData<T>(url: string, formData: FormData, cfg: IRequestConfig = {}): Promise<RequestResponse<T>> {
        const headers = new Headers();
        return this.fetchPOST<T, FormData>(url, { }, headers, {
            ...cfg,
            contentType: "multipart/form-data",
        }, formData);
    }

    protected static async get<T=undefined>(url: string, cfg: IRequestConfig={}): Promise<RequestResponse<T>> {
        return this.fetchGET<T>(url, {}, new Headers(), cfg);
    }

    /* INSTANCE */
}
