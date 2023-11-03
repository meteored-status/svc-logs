import * as os from "node:os";
import * as zlib from "node:zlib";
import {type IncomingHttpHeaders, type IncomingMessage, type OutgoingHttpHeaders, type ServerResponse} from "node:http";

import {IErrorHandler} from "./router";
import {INetCache} from "./cache";
import {IPodInfo} from "../utiles/config";
import {IRespuesta} from "./interface";
import {type Net} from "./config/net";
import {type Tracer} from "./tracer";
import {pipeline} from "../utiles/stream";

declare var DESARROLLO: boolean;

export abstract class Respuesta {

    public time: number;
    private codigo?: number;
    private location?: string;
    private encoding?: string;
    private cache?: Date;
    private readonly cacheTags: string[];
    private lastModified?: Date;
    private etag?: string;
    private contentType?: string;
    private pasada?: string;
    private vary?: string[];
    private length?: number;
    private cacheControl?: string[];
    public responseHeaders: OutgoingHttpHeaders;
    public data: Buffer|null;

    protected constructor(private readonly respuesta: ServerResponse, public errorHandler: IErrorHandler, public readonly tracer: Tracer, protected readonly pod: IPodInfo, private config: Net) {
        this.time = Date.now();
        this.cacheTags = config.cacheTags.slice();
        this.responseHeaders = {
            "X-Meteored-Cache": "MISS",
        };
        this.data = null;
    }

    public abstract getHeaders(): IncomingHttpHeaders;
    public abstract transfiriendo(): void;
    public abstract terminado(): void;
    public abstract isTerminado(): boolean;
    protected abstract isCORS(): boolean;

    public getRespuesta(): ServerResponse {
        return this.respuesta;
    }

    public setStatus(status:number): Respuesta {
        this.codigo = status;
        return this;
    }

    public isOK(): boolean {
        return this.codigo==undefined || (this.codigo>=200 && this.codigo<400);
    }

    public setCache(fecha: Date): Respuesta {
        this.cache = fecha;
        return this;
    }

    public noTransform(uncheck: boolean = false): Respuesta {
        const cacheControl = this.cacheControl?.filter(actual=>actual!="no-transform")??[];
        if (!uncheck) {
            cacheControl.push("no-transform");
            this.cacheControl = cacheControl;
        } else if (cacheControl.length==0) {
            this.cacheControl = undefined;
        }
        return this;
    }

    public setCache1Hora(): Respuesta {
        this.cache = new Date(Date.now()+3600000);
        return this;
    }

    public setCache1Dia(): Respuesta {
        this.cache = new Date(Date.now()+86400000);
        return this;
    }

    public setCache1Mes(): Respuesta {
        this.cache = new Date(Date.now()+2592000000);
        return this;
    }

    public getCache(): Date {
        return this.cache??new Date();
    }

    public noCache(): Respuesta {
        this.cache = undefined;
        return this;
    }

    public addCacheTag(tag: string): Respuesta {
        if (!this.cacheTags.includes(tag)) {
            this.cacheTags.push(tag);
        }
        return this;
    }

    public setLastModified(fecha: Date): Respuesta {
        this.lastModified = fecha;
        return this;
    }

    public unsetLastModified(): Respuesta {
        this.lastModified = undefined;
        return this;
    }

    public setETag(tag: string): Respuesta {
        this.etag = `"${tag}"`;
        return this;
    }

    public unsetETag(): Respuesta {
        this.etag = undefined;
        return this;
    }

    public setContentType(content: string): Respuesta {
        this.contentType = content;
        return this;
    }

    public setContentTypeJSON(): Respuesta {
        this.contentType = "application/json; charset=UTF-8";
        return this;
    }

    public setContentTypeHTML(): Respuesta {
        this.contentType = "text/html; charset=UTF-8";
        return this;
    }

    public setContentTypeJavascript(): Respuesta {
        this.contentType = "application/javascript";
        return this;
    }

    public setContentTypeSVG(): Respuesta {
        this.contentType = "image/svg+xml";
        return this;
    }

    public setContentTypePNG(): Respuesta {
        this.contentType = "image/png";
        return this;
    }

    public setContentTypeWebP(): Respuesta {
        this.contentType = "image/webp";
        return this;
    }

    public setContentTypeJPG(): Respuesta {
        this.contentType = "image/jpeg";
        return this;
    }

    public setContentTypeGif(): Respuesta {
        this.contentType = "image/gif";
        return this;
    }

    public setPasada(pasada: string): Respuesta {
        this.pasada = pasada;
        return this;
    }

    public addVary(vary: string): Respuesta {
        if (!this.vary) {
            this.vary = [];
        }
        if (!this.vary.includes(vary)) {
            this.vary.push(vary);
        }
        return this;
    }

    public unsetVary(): Respuesta {
        this.vary = undefined;
        return this;
    }

    public addCustomHeader(header: string, value: string|number): Respuesta {
        this.responseHeaders[header] = value;
        return this;
    }

    public async error(status?: number, mensaje?: string, extra?: any): Promise<number>;
    public async error(mensaje?: string, status?: number, extra?: any): Promise<number>;
    public async error(a?: string|number, b?: string|number, extra?: any): Promise<number> {
        let status: number;
        let mensaje: string;
        if (typeof a == "number") {
            status = a;
        } else if (typeof b == "number") {
            status = b;
        } else {
            status = 404;
        }
        if (typeof a == "string") {
            mensaje = a;
        } else if (typeof b == "string") {
            mensaje = b;
        } else {
            mensaje = "Not found";
        }
        return this.errorHandler.handleError(this, status, mensaje, extra);
    }

    public async redirect(location: string): Promise<number> {
        this.codigo = this.codigo??301;
        this.location = location;
        return this.sendData(null);
    }

    public async sendRespuesta<T=IRespuesta<any>>(respuesta: T): Promise<number> {
        if (!this.config.compress) {
            return this.sendData(Buffer.from(JSON.stringify(respuesta), 'utf-8'));
        }
        return this.sendDataCompress(Buffer.from(JSON.stringify(respuesta), 'utf-8'));
    }

    public async sendHTML(respuesta: string): Promise<number> {
        this.setContentTypeHTML();
        if (!this.config.compress) {
            return this.sendData(Buffer.from(respuesta, 'utf-8'));
        }
        return this.sendDataCompress(Buffer.from(respuesta, 'utf-8'));
    }

    public async sendDataCompress(data: Buffer): Promise<number> {
        const headers = this.getHeaders();
        this.addVary("Accept-Encoding");
        if (headers["accept-encoding"]!=undefined) {
            let promesa: Promise<Buffer>;
            if (headers["accept-encoding"].includes("br")) {
                promesa = new Promise<Buffer>((resolve: Function, reject: Function) => {
                    zlib.brotliCompress(data, (error: Error|null, result: Buffer)=>{
                        if (!error) {
                            this.encoding = "br";
                            resolve(result);
                        } else {
                            reject(error);
                        }
                    });
                });
            } else if (headers["accept-encoding"].includes("gzip")) {
                promesa = new Promise<Buffer>((resolve: Function, reject: Function) => {
                    zlib.gzip(data, (error: Error|null, result: Buffer)=>{
                        if (!error) {
                            this.encoding = "gzip";
                            resolve(result);
                        } else {
                            reject(error);
                        }
                    });
                });
            } else if (headers["accept-encoding"].includes("deflate")) {
                promesa = new Promise<Buffer>((resolve: Function, reject: Function) => {
                    zlib.deflate(data, (error: Error|null, result: Buffer)=>{
                        if (!error) {
                            this.encoding = "deflate";
                            resolve(result);
                        } else {
                            reject(error);
                        }
                    });
                });
            } else {
                promesa = Promise.resolve(data);
            }

            return this.sendData(await promesa);
        }

        return this.sendData(data);
    }

    public async send301(location: string): Promise<number> {
        this.codigo = 301;
        this.responseHeaders["location"] = location;
        return this.sendData(null);
    }

    public async send304(): Promise<number> {
        this.codigo = 304;
        return this.sendData(null);
    }

    public async sendData(respuesta: Buffer|null): Promise<number> {
        this.length = respuesta!=null?Buffer.byteLength(respuesta):0;

        this.data = respuesta;

        return this.responder();
    }

    private enviarCabeceras(): number {
        const status = this.codigo??200;
        const responseHeaders: OutgoingHttpHeaders = this.responseHeaders;
        if (this.isCORS()) {
            responseHeaders["Access-Control-Allow-Origin"] = "*";
        }
        if (this.lastModified) {
            responseHeaders["Last-Modified"] = this.lastModified.toUTCString();
        }
        if (this.location) {
            responseHeaders["location"] = this.location;
        }
        if (this.cache) {
            const tiempo = Math.floor((this.cache.getTime()-Date.now())/1000);
            if (tiempo>0) {
                responseHeaders["Expires"] = this.cache.toUTCString();
                // this.cacheControl??=[];
                // this.cacheControl.push("public");
                // this.cacheControl.push(`max-age=${tiempo}`);
                // responseHeaders["Cache-Control"] = `public, max-age=${tiempo}`;
            } else {
                responseHeaders["Expires"] = new Date(Date.now()-3600000).toUTCString();
                // this.cacheControl??=[];
                // this.cacheControl.push("private");
                // this.cacheControl.push("max-age=0");
                // this.cacheControl.push("must-revalidate");
                // responseHeaders["Cache-Control"] = "private, max-age=0, must-revalidate";
            }
        } else {
            responseHeaders["Expires"] = new Date(Date.now()-3600000).toUTCString();
            // this.cacheControl??=[];
            // this.cacheControl.push("private");
            // this.cacheControl.push("max-age=0");
            // this.cacheControl.push("must-revalidate");
            // responseHeaders["Cache-Control"] = "private, max-age=0, must-revalidate";
        }
        if (this.cacheControl!=undefined && this.cacheControl.length>0) {
            responseHeaders["Cache-Control"] = this.cacheControl;
        }
        if (this.cacheTags.length > 0) {
            responseHeaders["Cache-Tag"] = this.cacheTags;
        }
        if (this.etag) {
            responseHeaders["ETag"] = this.etag;
        }
        responseHeaders["Content-Type"] = this.contentType??"application/json; charset=UTF-8";
        if (this.encoding) {
            responseHeaders["Content-Encoding"] = this.encoding;
        }
        if (this.vary && this.vary.length>0) {
            responseHeaders["Vary"] = this.vary.length==1?this.vary[0]:this.vary;
        }
        responseHeaders["X-Meteored-Node"] = DESARROLLO?this.pod.servicio:os.hostname();
        responseHeaders["X-Meteored-Zone"] = this.pod.zona;
        responseHeaders["X-Meteored-Version"] = this.pod.version;
        if (this.pasada) {
            responseHeaders["X-Meteored-Pass"] = this.pasada;
        }
        if (this.length!==undefined) {
            responseHeaders['Content-Length'] = this.length;
        }
        this.respuesta.writeHead(status, responseHeaders);

        return status;
    }

    private async responder(): Promise<number> {
        if (this.isTerminado()) {
            if (this.isOK()) {
                return this.codigo??0;
            }
            return Promise.reject("Respuesta ya enviada");
        }
        this.transfiriendo();
        const codigo = this.enviarCabeceras();

        if (this.data!=null) {
            this.respuesta.write(this.data);
        }
        this.respuesta.end();
        this.terminado();

        this.tracer.setCode(codigo);

        return codigo;
    }

    public async sendCache(cache: INetCache, datos: Buffer|null): Promise<number> {
        this.codigo = cache.code;
        this.responseHeaders = cache.headers;
        this.transfiriendo();

        this.respuesta.writeHead(cache.code, cache.headers);

        if (datos!=null) {
            this.respuesta.write(datos);
        }
        this.respuesta.end();
        this.terminado();

        this.tracer.setCode(cache.code);

        return cache.code;
    }

    public async sendStream(datos: NodeJS.ReadableStream): Promise<number> {
        if (this.isTerminado()) {
            return Promise.reject("Respuesta ya enviada");
        }
        this.transfiriendo();
        const codigo = this.enviarCabeceras();
        await pipeline(datos, this.respuesta);
        this.terminado();

        this.tracer.setCode(codigo);

        return codigo;
    }

    public async forwardIncommingConnection(datos: IncomingMessage): Promise<number> {
        if (this.isTerminado()) {
            return Promise.reject("Respuesta ya enviada");
        }
        this.transfiriendo();
        const tags = datos.headers["cache-tag"];
        if (tags!=undefined) {
            this.cacheTags.push(tags as string);
        }
        let chain = datos.headers["x-meteored-node-chain"];
        if (chain==undefined) {
            chain = [];
        }
        if (!Array.isArray(chain)) {
            chain = [chain];
        }
        const padre = datos.headers["x-meteored-node"];
        if (padre!=undefined) {
            if (!Array.isArray(padre)) {
                chain.unshift(padre);
            } else {
                chain.unshift(...padre);
            }
        }
        this.respuesta.writeHead(datos.statusCode as number, {
            ...datos.headers,
            "x-meteored-node": DESARROLLO?this.pod.servicio:os.hostname(),
            "x-meteored-node-chain": chain,
            "cache-tag": this.cacheTags,
        });
        await pipeline(datos, this.respuesta);
        this.terminado();

        this.tracer.setCode(datos.statusCode??0);
        return datos.statusCode as number;
    }
}
