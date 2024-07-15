import {IRequestConfig, Request, RequestError, RequestResponse} from "./request";
import {error} from "../browser/log";
import {ErrorCode} from "./interface";

export class FrontendRequest extends Request {
    /* STATIC */
    // protected static override async get<T>(url: string, cfg: IRequestConfig={}): Promise<RequestResponse<T>> {
    //     return this.fetch<T>(url, {}, new Headers(), cfg);
    // }

    protected static override async parseRespuesta<T>(respuesta: Response, config: IRequestConfig, url: string): Promise<RequestResponse<T>> {
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
        }));
    }

    protected static async parseRespuestaArrayBuffer(respuesta: Response): Promise<RequestResponse<ArrayBuffer>> {
        const expires = respuesta.headers.get("expires");
        return {
            data: await respuesta.arrayBuffer(),
            headers: respuesta.headers,
            expires: expires!=null?new Date(expires):undefined,
        };
    }

    public static async getBuffer(url: string, cfg: IRequestConfig={}): Promise<RequestResponse<ArrayBuffer>> {
        if (PRODUCCION) {
            return this.fetch<Buffer>(url, {}, new Headers(), {
                buffer: true,
            });
        }

        try {
            return await this.fetch<Buffer>(url, {}, new Headers(), {
                buffer: true,
            });
        } catch (err) {
            if (!url.startsWith("http://localhost:") || cfg.dominioAlternativo==undefined) {
                return Promise.reject(err);
            }

            const partes = url.replace("http://localhost:", "").split("/");
            partes.shift();
            partes.unshift(cfg.dominioAlternativo);
            return this.fetch<Buffer>(partes.join("/"), {}, new Headers(), {
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
        const headers = new Headers();
        headers.append("Accept", "application/json");
        headers.append("Content-Type", "application/json");
        return this.fetch<T>(url, {
            method: "POST",
            body: JSON.stringify(data),
        }, headers, cfg);
    }

    protected static async postFormData<T>(url: string, formData: FormData, cfg: IRequestConfig = {}): Promise<RequestResponse<T>> {
        const headers = new Headers();
        headers.append("Accept", "application/json");
        return this.fetch<T>(url, {
            method: "POST",
            body: formData,
        }, headers, cfg);
    }

    protected static error(...txt: any): void {
        error(txt);
    }

    /* INSTANCE */
}
