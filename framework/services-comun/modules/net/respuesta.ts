import * as zlib from "node:zlib";
import {type IncomingHttpHeaders, type IncomingMessage, type OutgoingHttpHeaders, type ServerResponse} from "node:http";

import {IErrorHandler} from "./router";
import {INetCache} from "./cache";
import {IRespuesta} from "./interface";
import {type Net} from "./config/net";
// import {type Tracer} from "./tracer";
import {pipeline} from "../utiles/stream";

export abstract class Respuesta {
    /* STATIC */
    public static SERVICE: string = "localhost";
    public static POD: string = "localhost";
    public static ZONA: string = "desarrollo";
    public static VERSION: string = "0000.00.00-000";
    private static CHUNK_SIZE = 1024;

    /* INSTANCE */
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
    private readonly vary: Set<string>;
    private length?: number;
    private readonly cacheControl: Set<string>;
    public responseHeaders: OutgoingHttpHeaders;
    public data: Buffer|null;

    protected constructor(private readonly respuesta: ServerResponse, public errorHandler: IErrorHandler, /*public readonly tracer: Tracer,*/ private config: Net) {
        this.time = Date.now();
        this.cacheTags = config.cacheTags.slice();
        this.responseHeaders = {
            // "X-Meteored-Cache": "MISS",
        };
        this.cacheControl = new Set<string>();
        this.vary = new Set<string>();
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

    public setCache10Min(): Respuesta {
        this.cache = new Date(Date.now()+600_000);
        return this;
    }

    public setCache1Hora(): Respuesta {
        this.cache = new Date(Date.now()+3_600_000);
        return this;
    }

    public setCache1Dia(): Respuesta {
        this.cache = new Date(Date.now()+86_400_000);
        return this;
    }

    public setCache1Mes(): Respuesta {
        this.cache = new Date(Date.now()+2_592_000_000);
        return this;
    }

    public setCache1Anno(): Respuesta {
        this.cache = new Date(Date.now()+31_536_000_000);
        return this;
    }

    public getCache(): Date {
        return this.cache??new Date();
    }

    public noCache(): Respuesta {
        this.cache = undefined;
        this.cacheControl.add("private");
        this.cacheControl.add("no-cache");
        this.cacheControl.add("no-store");
        this.cacheControl.add("must-revalidate");
        return this;
    }

    public noTransform(uncheck: boolean = false): Respuesta {
        if (!uncheck) {
            this.cacheControl.add("no-transform");
        } else {
            this.cacheControl.delete("no-transform");
        }
        return this;
    }

    public mustRevalidate(): Respuesta {
        this.cacheControl.add(`must-revalidate`);
        return this;
    }

    public proxyRevalidate(): Respuesta {
        this.cacheControl.add(`proxy-revalidate`);
        return this;
    }

    public staleWhileRevalidate(max: number=0): Respuesta {
        this.cacheControl.add(`stale-while-revalidate=${max}`);
        return this;
    }

    public staleIfError(max: number=0): Respuesta {
        this.cacheControl.add(`stale-if-error=${max}`);
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

    public setETag(etag: string, strong=false): Respuesta {
        this.etag = !strong?
            etag:
            `"${etag}"`;
        return this;
    }

    public unsetETag(): Respuesta {
        this.etag = undefined;
        return this;
    }

    public setContentEncoding(content: string): Respuesta {
        this.encoding = content;
        return this;
    }

    public setContentEncodingBrotli(): Respuesta {
        this.encoding = "br";
        return this;
    }

    public setContentEncodingGzip(): Respuesta {
        this.encoding = "gzip";
        return this;
    }

    public setContentEncodingDeflate(): Respuesta {
        this.encoding = "deflate";
        return this;
    }

    public setContentType(content: string): Respuesta {
        this.contentType = content;
        return this;
    }

    public setContentTypeText(): Respuesta {
        this.contentType = `text/plain`;
        return this;
    }

    public setContentTypeJSON(): Respuesta {
        this.contentType = `application/json; charset=UTF-8`;
        return this;
    }

    public setContentTypeHTML(charset: string|null="UTF-8"): Respuesta {
        this.contentType = charset!=null ?
            `text/html; charset=${charset}` :
            "text/html";
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

    public setContentTypePDF(): Respuesta {
        this.contentType = "application/pdf";
        return this;
    }

    public setContentTypeXML(): Respuesta {
        this.contentType = "application/xml";
        return this;
    }

    public setContentTypeTextPlain(): Respuesta {
        this.contentType = `text/plain`;
        return this;
    }

    public setPasada(pasada: string): Respuesta {
        this.pasada = pasada;
        return this;
    }

    public addVary(vary: string): Respuesta {
        this.vary.add(vary);
        return this;
    }

    public addVaryAcceptEncoding(): Respuesta {
        this.vary.add("Accept-Encoding");
        return this;
    }

    public addVaryUserAgent(): Respuesta {
        this.vary.add("User-Agent");
        return this;
    }

    public unsetVary(): Respuesta {
        this.vary.clear();
        return this;
    }

    public addCustomHeader(header: string, value: string|number): Respuesta {
        if (this.responseHeaders[header]==undefined) {
            this.responseHeaders[header] = value;
        } else {
            this.responseHeaders[header] = `${this.responseHeaders[header]}, ${value}`;
        }
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
        this.addVaryAcceptEncoding();
        if (headers["accept-encoding"]!=undefined) {
            let promesa: Promise<Buffer>;
            if (headers["accept-encoding"].includes("br")) {
                promesa = new Promise<Buffer>((resolve: Function, reject: Function) => {
                    zlib.brotliCompress(data, (error: Error|null, result: Buffer)=>{
                        if (!error) {
                            this.setContentEncodingBrotli();
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
                            this.setContentEncodingGzip();
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
                            this.setContentEncodingDeflate();
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
        if (this.lastModified!=undefined) {
            responseHeaders["Last-Modified"] = this.lastModified.toUTCString();
        }
        if (this.location!=undefined) {
            responseHeaders["location"] = this.location;
        }
        if (this.cache!=undefined) {
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
                // this.cacheControl.push("no-cache");
                // this.cacheControl.push("no-store");
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
        if (this.cacheControl.size>0) {
            responseHeaders["Cache-Control"] = [...this.cacheControl];
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
        if (this.vary.size>0) {
            responseHeaders["Vary"] = [...this.vary];
        }
        responseHeaders["X-Meteored-Zone"] = Respuesta.ZONA;
        responseHeaders["X-Meteored-Service"] = Respuesta.SERVICE;
        responseHeaders["X-Meteored-Node"] = Respuesta.POD;
        responseHeaders["X-Meteored-Version"] = Respuesta.VERSION;
        if (this.pasada!=undefined) {
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
            await this.write(this.data);
            // this.respuesta.write(this.data);
        }
        this.respuesta.end();
        this.terminado();

        // this.tracer.setCode(codigo);

        return codigo;
    }

    private async write(data: Buffer): Promise<void> {
        const CHUNK_SIZE = Respuesta.CHUNK_SIZE; // Define el tamaño del paquete aquí
        let offset = 0;

        const writeChunk = (): Promise<void> => {
            return new Promise((resolve, reject) => {
                const end = Math.min(offset + CHUNK_SIZE, data.length);
                const chunk = data.slice(offset, end);
                const ok = this.respuesta.write(chunk);

                if (ok) {
                    offset = end;
                    if (offset < data.length) {
                        resolve(writeChunk()); // Si aún quedan datos, escribe el siguiente paquete
                    } else {
                        resolve(); // Todos los datos se han escrito
                    }
                } else {
                    this.respuesta.once('drain', () => {
                        offset = end;
                        if (offset < data.length) {
                            resolve(writeChunk()); // Si aún quedan datos, escribe el siguiente paquete
                        } else {
                            resolve(); // Todos los datos se han escrito
                        }
                        // resolve(writeChunk()); // Continúa escribiendo después de que se haya vaciado el búfer
                    });
                }
            });
        };

        return writeChunk();
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

        // this.tracer.setCode(cache.code);

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

        // this.tracer.setCode(codigo);

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
            "x-meteored-service": Respuesta.SERVICE,
            "x-meteored-node": Respuesta.POD,
            "x-meteored-node-chain": chain,
            "cache-tag": this.cacheTags,
        });
        await pipeline(datos, this.respuesta);
        this.terminado();

        // this.tracer.setCode(datos.statusCode??0);
        return datos.statusCode as number;
    }
}
