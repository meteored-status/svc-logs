import http, {IncomingMessage as IncomingMessageBase} from "node:http";
import https from "node:https";
import opentelemetry from "@opentelemetry/api";
import {RequestCacheDisk} from "./cache/disk";

import {IRequestConfig, Request, RequestResponse} from "./request";
import {RequestCache} from "./cache";
import {PromiseDelayed} from "../utiles/promise";
import {error} from "../utiles/log";

export interface IncomingMessage extends IncomingMessageBase {}

export class BackendRequest extends Request {
    /* STATIC */
    public static CACHE: RequestCache = new RequestCacheDisk();

    protected static propagarContexto(cfg?: IRequestConfig): IRequestConfig {
        cfg ??= {};
        opentelemetry.propagation.inject(opentelemetry.context.active(), cfg);

        return cfg;
    }

    protected static override async get<T=undefined>(url: string, cfg: IRequestConfig={}): Promise<RequestResponse<T>> {
        if (PRODUCCION) {
            return super.get<T>(url, this.propagarContexto(cfg));
        }

        try {
            return await super.get<T>(url, this.propagarContexto(cfg));
        } catch (err) {
            if (!url.startsWith("http://localhost:") || cfg.dominioAlternativo==undefined) {
                return Promise.reject(err);
            }

            const partes = url.replace("http://localhost:", "").split("/");
            partes.shift();
            partes.unshift(cfg.dominioAlternativo);
            return super.get<T>(partes.join("/"), this.propagarContexto(cfg));
        }
    }

    private static TMP: NodeJS.Dict<Promise<RequestResponse>> = {};
    protected static async getCache<T>(url: string, cfg: IRequestConfig={}): Promise<RequestResponse<T>> {
        return this.TMP[url] ??= this.getCacheEjecutar<T>(url, cfg);
    }
    protected static async getCacheEjecutar<T>(url: string, cfg: IRequestConfig={}): Promise<RequestResponse<T>> {
        setTimeout(()=>{
            delete this.TMP[url];
        }, 10000);
        if (cfg.auth!=undefined) {
            return this.get<T>(url, cfg);
        }

        try {
            const salida = await this.CACHE.check(url);
            return this.checkRespuesta<T>(JSON.parse(salida.data.toString()), salida.headers, url);
        } catch (err) {
            const salida = await this.get<T>(url, cfg);
            PromiseDelayed()
                .then(async ()=>{
                    const data = Buffer.from(JSON.stringify(salida.data));
                    await this.CACHE.save(url, {
                        ...salida,
                        data,
                    }).catch(()=>{});
                });

            return salida;
        }
    }

    public static async getForward(url: string): Promise<IncomingMessage> {
        return new Promise<IncomingMessage>((resolve)=> {
            const requester = url.startsWith("https://")?https:http;
            const traceparent = this.propagarContexto().traceparent;
            const headers = traceparent!=undefined ? { traceparent } : {};
            requester.get(url, {
                headers,
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
            if (!url.startsWith("http://localhost:") || cfg?.dominioAlternativo==undefined) {
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
            if (!url.startsWith("http://localhost:") || cfg?.dominioAlternativo==undefined) {
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
