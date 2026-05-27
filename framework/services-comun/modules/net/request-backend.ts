/**
 * Editor: David Martínez Moya
 * Fecha: Tue, 26 May 2026 09:10:16 GMT
 * Hash: 36e0ac7ab0312268f2fe3b4a7a934790
 * Versión: 2026.5.26+1-davidmartinezmoya
 */

import http, {IncomingMessage as IncomingMessageBase} from "node:http";
import https from "node:https";
import {ErrorCode, type IRespuesta} from "@mr/core-network/client/http/interface";
import {RequestError} from "@mr/core-network/client/http/error";

import {RequestCache} from "./cache";
import {RequestCacheDisk} from "./cache/disk";
import {PromiseDelayed} from "../utiles/promise";
import {error} from "../utiles/log";

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
    headers?: Record<string, string>;
}

export interface IRequestConfigCache extends IRequestConfig {
    cache?: RequestCache;
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

        const extra = await respuesta.json().then(r => r.info?.extra).catch(() => undefined);

        // SI EL CÓDIGO NO ES 200 ENTONCES VA A SALTAR AQUÍ
        return Promise.reject(new RequestError({
            status: respuesta.status,
            url,
            headers: respuesta.headers,
            code: ErrorCode.NETWORK,
            message: respuesta.statusText,
            extra
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
            init.method = init.method || "POST";
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
                case "multipart/form-data":
                    init.body = post as unknown as FormData;
                    headers.delete("Content-Type");
                    break;
            }
        }

        // Añadir cabeceras personalizadas desde cfg.headers
        if (cfg.headers && typeof cfg.headers === 'object') {
            for (const [key, value] of Object.entries(cfg.headers)) {
                if (typeof value === 'string' && !headers.has(key)) {
                    headers.set(key, value);
                }
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

            if (e instanceof RequestError) {
                return Promise.reject(e);
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

    protected static async head(url: string, cfg: IRequestConfig = {}): Promise<RequestResponse<Buffer>> {
        cfg.buffer = true;
        if (PRODUCCION) {
            return this.fetch<Buffer>(url, {method: "head"}, new Headers(), this.propagarContexto(cfg));
        }

        try {
            return await this.fetch<Buffer>(url, {}, new Headers(), this.propagarContexto(cfg));
        } catch (err) {
            if (!url.startsWith("http://localhost:") || cfg.dominioAlternativo == undefined) {
                return Promise.reject(err);
            }

            const partes = url.replace("http://localhost:", "").split("/");
            partes.shift();
            partes.unshift(cfg.dominioAlternativo);
            return this.fetch<Buffer>(partes.join("/"), {}, new Headers(), this.propagarContexto(cfg));
        }
    }

    private static TMP: NodeJS.Dict<Promise<RequestResponse>> = {};

    public static async getCache<T>(url: string, cfg: IRequestConfigCache = {}): Promise<RequestResponse<T>> {
        return this.TMP[url] ??= this.getCacheEjecutar<T>(url, cfg);
    }

    protected static async getCacheEjecutar<T>(url: string, {cache=this.CACHE, ...cfg}: IRequestConfigCache = {}): Promise<RequestResponse<T>> {
        setTimeout(() => {
            delete this.TMP[url];
        }, 10000);
        if (cfg.auth) {
            return this.get<T>(url, cfg);
        }

        try {
            const salida = await cache.check(url);
            return {
                data: JSON.parse(salida.data.toString("utf-8")),
                headers: salida.headers,
                expires: salida.expires,
            };
        } catch (err) {
            const salida = await this.get<T>(url, cfg);
            PromiseDelayed()
                .then(async () => {
                    const data = Buffer.from(JSON.stringify(salida.data));
                    await cache.save(url, {
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

    protected static async put<T, P>(url: string, post: P, cfg?: IRequestConfig): Promise<RequestResponse<T>> {
        if (PRODUCCION) {
            return this.fetch<T, P>(url, {
                method: "PUT",
            }, new Headers(), this.propagarContexto(cfg), post);
        }

        try {
            return await this.fetch<T, P>(url, {
                method: "PUT",
            }, new Headers(), this.propagarContexto(cfg), post);
        } catch (err) {
            if (!url.startsWith("http://localhost:") || cfg?.dominioAlternativo == undefined) {
                return Promise.reject(err);
            }

            const partes = url.replace("http://localhost:", "").split("/");
            partes.shift();
            partes.unshift(cfg.dominioAlternativo);
            return this.fetch<T, P>(partes.join("/"), {
                method: "PUT",
            }, new Headers(), this.propagarContexto(cfg), post);
        }
    }

    protected static async delete<T = undefined>(url: string, cfg: IRequestConfig = {}): Promise<RequestResponse<T>> {
        if (PRODUCCION) {
            return this.fetch<T>(url, {
                method: "DELETE",
            }, new Headers(), this.propagarContexto(cfg));
        }

        try {
            return await this.fetch<T>(url, {
                method: "DELETE",
            }, new Headers(), this.propagarContexto(cfg));
        } catch (err) {
            if (!url.startsWith("http://localhost:") || cfg.dominioAlternativo == undefined) {
                return Promise.reject(err);
            }

            const partes = url.replace("http://localhost:", "").split("/");
            partes.shift();
            partes.unshift(cfg.dominioAlternativo);
            return this.fetch<T>(partes.join("/"), {
                method: "DELETE",
            }, new Headers(), this.propagarContexto(cfg));
        }
    }

    protected static errorLog(...txt: any): void {
        error(txt);
    }

    /* INSTANCE */
}
