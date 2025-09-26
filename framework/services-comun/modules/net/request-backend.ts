import http, {IncomingMessage as IncomingMessageBase} from "node:http";
import https from "node:https";
// import opentelemetry from "@opentelemetry/api";
import {RequestCacheDisk} from "./cache/disk";
import {ErrorCode, IRespuesta} from "./interface";

import {RequestCache} from "./cache";
import {PromiseDelayed} from "../utiles/promise";
import {error} from "../utiles/log";
import {RequestError} from "./request/error";
export interface IncomingMessage extends IncomingMessageBase {
}

export interface IRequest {
    auth?: string;
    x_u_email?: string;
    timeout: number;
    retry: number;
    retryOnTimeout: boolean; // si es true, se reintentará la petición si se produce un timeout del servidor (no del campo tiemout).
    buffer: boolean;
    // traceparent?: string; // para OpenTelemetry, se inyecta en los headers de la petición.
    contentType?: string;
    dominioAlternativo?: string;
}

export interface IRequestConfig extends Partial<IRequest> {
}

export interface RequestResponse<T = any> {
    data: T;
    headers: Headers;
    expires?: Date;
}

export class BackendRequest {
    /* STATIC */
    public static CACHE: RequestCache = new RequestCacheDisk();

    protected static parseConfig(cfg?: IRequestConfig): IRequest {
        return {
            timeout: 1000,
            retry: 0,
            retryOnTimeout: false,
            buffer: false,
            ...cfg,
        };
    }

    protected static async parseRespuestaBuffer(respuesta: Response): Promise<RequestResponse<Buffer>> {
        const expires = respuesta.headers.get("expires");
        const resultHeaders = new Headers(respuesta.headers);

        if (DESARROLLO) {
            resultHeaders.delete('Content-Encoding');
        }

        return {
            data: Buffer.from(await respuesta.arrayBuffer()),
            headers: resultHeaders,
            expires: expires != null ? new Date(expires) : undefined,
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
            status: 500,
            url,
            headers,
            ...data.info,
        }));
    }

    protected static async parseRespuestaJSON<T>(respuesta: Response, url: string): Promise<RequestResponse<T>> {
        const data: IRespuesta<T> = await respuesta.json();

        return await this.checkRespuesta<T>(data, respuesta.headers, url);
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
            status: respuesta.status,
            url,
            headers: respuesta.headers,
            code: ErrorCode.NETWORK,
            message: respuesta.statusText,
        }));
    }

    protected static async fetch<T, K = undefined>(url: string, init: RequestInit, headers: Headers, cfg: IRequestConfig, post?: K, retry: number = 0): Promise<RequestResponse<T>> {
        const config = this.parseConfig(cfg);
        let timeoutID: NodeJS.Timeout | undefined;
        let abortado = false;
        if (cfg.timeout != undefined) {
            const timeout = new AbortController();
            timeoutID = setTimeout(() => {
                timeout.abort();
                abortado = true;
                timeoutID = undefined;
            }, cfg.timeout);
            init.signal = timeout.signal;
            // init.signal = AbortSignal.timeout(cfg.timeout);
        }

        if (config.auth != undefined && !headers.has("Authorization")) {
            headers.set("Authorization", config.auth);
        }
        if (config.x_u_email != undefined && !headers.has("x-u-email")) {
            headers.set("x-u-email", config.x_u_email);
        }
        // if (config.traceparent && !headers.has("traceparent")) {
        //     headers.set("traceparent", config.traceparent);
        // }
        if (post != undefined) {
            init.method = "POST";
            init.cache = "no-cache";
            if (!headers.has("Content-Type")) {
                if (cfg.contentType != undefined) {
                    headers.set("Content-Type", cfg.contentType);
                } else {
                    headers.set("Content-Type", "application/json");
                }
            }
            switch (headers.get("Content-Type")) {
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
            if (timeoutID != undefined) {
                clearTimeout(timeoutID);
            }
            return await this.parseRespuesta(respuesta, config, url);
        } catch (e) {
            if (abortado) {
                return Promise.reject(new RequestError({
                    status: 500,
                    url,
                    headers,
                    code: ErrorCode.TIMEOUT,
                    message: `${url} => "Timeout tras ${cfg.timeout}ms"`,
                    extra: e,
                }));
            }

            if (PRODUCCION && cfg.retryOnTimeout && retry < 10) {
                retry++;
                await PromiseDelayed(retry * 1000);
                return this.fetch<T, K>(url, init, headers, cfg, post, retry);
            }

            if (e instanceof TypeError) {
                return Promise.reject(new RequestError({
                    status: 500,
                    url,
                    headers,
                    code: ErrorCode.NETWORK,
                    message: `${url} => "${e.message}"`,
                    extra: e,
                }));
            }

            return Promise.reject(new RequestError({
                status: 500,
                url,
                headers,
                code: ErrorCode.NETWORK,
                message: `${url} => "Error desconocido"`,
                extra: e,
            }));
        }
    }

    protected static propagarContexto(cfg?: IRequestConfig): IRequestConfig {
        cfg ??= {};
        // opentelemetry.propagation.inject(opentelemetry.context.active(), cfg);

        return cfg;
    }

    protected static async get<T = undefined>(url: string, cfg: IRequestConfig = {}): Promise<RequestResponse<T>> {
        if (PRODUCCION) {
            return this.fetch<T>(url, {}, new Headers(), this.propagarContexto(cfg));
        }

        try {
            return await this.fetch<T>(url, {}, new Headers(), this.propagarContexto(cfg));
        } catch (err) {
            if (!url.startsWith("http://localhost:") || cfg.dominioAlternativo == undefined) {
                return Promise.reject(err);
            }

            const partes = url.replace("http://localhost:", "").split("/");
            partes.shift();
            partes.unshift(cfg.dominioAlternativo);
            return this.fetch<T>(partes.join("/"), {}, new Headers(), this.propagarContexto(cfg));
        }
    }

    private static TMP: NodeJS.Dict<Promise<RequestResponse>> = {};

    protected static async getCache<T>(url: string, cfg: IRequestConfig = {}): Promise<RequestResponse<T>> {
        return this.TMP[url] ??= this.getCacheEjecutar<T>(url, cfg);
    }

    protected static async getCacheEjecutar<T>(url: string, cfg: IRequestConfig = {}): Promise<RequestResponse<T>> {
        setTimeout(() => {
            delete this.TMP[url];
        }, 10000);
        if (cfg.auth != undefined) {
            return this.get<T>(url, cfg);
        }

        try {
            const salida = await this.CACHE.check(url);
            return this.checkRespuesta<T>(JSON.parse(salida.data.toString()), salida.headers, url);
        } catch (err) {
            const salida = await this.get<T>(url, cfg);
            PromiseDelayed()
                .then(async () => {
                    const data = Buffer.from(JSON.stringify(salida.data));
                    await this.CACHE.save(url, {
                        ...salida,
                        data,
                    }).catch(() => {
                    });
                });

            return salida;
        }
    }

    public static async getForward(url: string): Promise<IncomingMessage> {
        return new Promise<IncomingMessage>((resolve) => {
            const requester = url.startsWith("https://") ? https : http;
            // const traceparent = this.propagarContexto().traceparent;
            // const headers = traceparent != undefined ? {traceparent} : {};
            requester.get(url, {
                headers: {},
            }, (res) => {
                resolve(res);
            });
        });
    }

    public static async getBuffer(url: string, cfg?: IRequestConfig): Promise<RequestResponse<Buffer>> {
        if (PRODUCCION) {
            return this.fetch<Buffer>(url, {}, new Headers(), {
                ...this.propagarContexto(cfg),
                buffer: true,
            });
        }

        try {
            return await this.fetch<Buffer>(url, {}, new Headers(), {
                ...this.propagarContexto(cfg),
                buffer: true,
            });
        } catch (err) {
            if (!url.startsWith("http://localhost:") || cfg?.dominioAlternativo == undefined) {
                return Promise.reject(err);
            }

            const partes = url.replace("http://localhost:", "").split("/");
            partes.shift();
            partes.unshift(cfg.dominioAlternativo);
            return this.fetch<Buffer>(partes.join("/"), {}, new Headers(), {
                ...this.propagarContexto(cfg),
                buffer: true,
            });
        }
    }

    protected static async post<T, P>(url: string, post: P, cfg?: IRequestConfig): Promise<RequestResponse<T>> {
        if (PRODUCCION) {
            return this.fetch<T, P>(url, {
                method: "POST",
            }, new Headers(), this.propagarContexto(cfg), post);
        }

        try {
            return await this.fetch<T, P>(url, {
                method: "POST",
            }, new Headers(), this.propagarContexto(cfg), post);
        } catch (err) {
            if (!url.startsWith("http://localhost:") || cfg?.dominioAlternativo == undefined) {
                return Promise.reject(err);
            }

            const partes = url.replace("http://localhost:", "").split("/");
            partes.shift();
            partes.unshift(cfg.dominioAlternativo);
            return this.fetch<T, P>(partes.join("/"), {
                method: "POST",
            }, new Headers(), this.propagarContexto(cfg), post);
        }
    }

    protected static errorLog(...txt: any): void {
        error(txt);
    }

    /* INSTANCE */
}
