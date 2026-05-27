/**
 * Editor: José Antonio Jiménez
 * Fecha: Mon, 18 May 2026 11:19:03 GMT
 * Hash: 0c589b5877d12d365904b562578e8386
 * Versión: 2026.5.18+3-josantoniojimnez
 * Anterior: 2026.5.18+2-josantoniojimnez
 */

import zlib from "node:zlib";
import type {IncomingHttpHeaders, IncomingMessage, OutgoingHttpHeaders, ServerResponse} from "node:http";

import type {INetCache} from "services-comun/modules/net/cache";
import {buffer2stream, pipeline} from "services-comun/modules/utiles/stream";

import type {IErrorHandler} from "./router";
import type {Net} from "./config/net";

/**
 * Contexto de despliegue del proceso para poblar las cabeceras `X-Meteored-*`
 * sin depender de estáticos mutables campo a campo.
 *
 * @property service - Nombre del servicio.
 * @property pod     - Identificador del pod/nodo.
 * @property zona    - Zona de despliegue.
 * @property version - Versión del despliegue.
 */
export interface IRespuestaContext {
    service: string;
    pod: string;
    zona: string;
    version: string;
}

/**
 * Política del encabezado `Referrer-Policy` enviado en la respuesta HTTP.
 *
 * - `NO_REFERER`                    — No envía el encabezado `Referer` en ninguna petición.
 * - `NO_REFERRER_WHEN_DOWNGRADE`    — Omite el `Referer` al navegar de HTTPS a HTTP.
 * - `ORIGIN`                        — Envía únicamente el origen (esquema + host + puerto).
 * - `ORIGIN_WHEN_CROSS_ORIGIN`      — Origen completo en peticiones cross-origin; URL completa en same-origin.
 * - `SAME_ORIGIN`                   — Envía el `Referer` solo en peticiones al mismo origen.
 * - `STRICT_ORIGIN`                 — Envía solo el origen; omite en HTTPS→HTTP.
 * - `STRICT_ORIGIN_WHEN_CROSS_ORIGIN` — Origen completo en same-origin; solo origen en cross-origin; omite en HTTPS→HTTP.
 * - `UNSAFE_URL`                    — Siempre envía la URL completa (sin fragmento). No recomendado.
 */
export enum TReferrerPolicy {
    NO_REFERER = "no-referrer",
    NO_REFERRER_WHEN_DOWNGRADE = "no-referrer-when-downgrade",
    ORIGIN = "origin",
    ORIGIN_WHEN_CROSS_ORIGIN = "origin-when-cross-origin",
    SAME_ORIGIN = "same-origin",
    STRICT_ORIGIN = "strict-origin",
    STRICT_ORIGIN_WHEN_CROSS_ORIGIN = "strict-origin-when-cross-origin",
    UNSAFE_URL = "unsafe-url",
}

/**
 * Clase base abstracta que encapsula el ciclo de vida y la construcción de una
 * respuesta HTTP del servidor.
 *
 * Gestiona cabeceras de caché, codificación de contenido, compresión (brotli, gzip,
 * deflate), escritura por chunks con soporte de back-pressure, reenvío de respuestas
 * upstream y políticas de seguridad (`CORS`, `Referrer-Policy`).
 *
 * Las subclases deben implementar:
 * - `getHeaders()` — devuelve las cabeceras de la petición entrante.
 * - `transfiriendo()` — marca la respuesta como en curso.
 * - `terminado()` — marca la respuesta como completada.
 * - `isTerminado()` — devuelve `true` si la respuesta ya fue enviada.
 * - `isCORS()` — devuelve `true` si la petición requiere cabeceras CORS.
 *
 * @property SERVICE  - Nombre del servicio; se incluye en `X-Meteored-Service`.
 * @property POD      - Nombre del pod/nodo; se incluye en `X-Meteored-Node`.
 * @property ZONA     - Zona de despliegue; se incluye en `X-Meteored-Zone`.
 * @property VERSION  - Versión del despliegue; se incluye en `X-Meteored-Version`.
 */
export abstract class Respuesta {
    private static CONTEXTO_DEFECTO: Readonly<IRespuestaContext> = Object.freeze({
        service: "localhost",
        pod: "localhost",
        zona: "desarrollo",
        version: "0000.00.00-000",
    });
    private static readonly CHUNK_SIZE = 1024;
    /**
     * Cabeceras hop-by-hop según RFC 7230 §6.1 que no deben reenviarse al cliente
     * cuando se proxifica una respuesta upstream. Mantenerlas puede provocar
     * request/response smuggling detrás de un proxy.
     */
    private static readonly HOP_BY_HOP: ReadonlySet<string> = new Set([
        "connection",
        "keep-alive",
        "proxy-authenticate",
        "proxy-authorization",
        "te",
        "trailer",
        "transfer-encoding",
        "upgrade",
    ]);

    public time: number;
    private readonly contexto: Readonly<IRespuestaContext>;
    private codigo?: number;
    private location?: string;
    private encoding?: string;
    private cache?: Date;
    private readonly cacheTags: string[];
    private lastModified?: Date;
    private etag?: string;
    private contentType?: string;
    private contentDisposition?: string;
    private pasada?: string;
    private readonly vary: Set<string>;
    private length?: number;
    private readonly cacheControl: Set<string>;
    public responseHeaders: OutgoingHttpHeaders;
    public data: Buffer|null;

    /**
     * Establece el contexto por defecto para nuevas respuestas.
     *
     * Se invoca en el bootstrap del servicio (p. ej. `EngineServer.prebuild`) una vez
     * que se conoce el despliegue real (`service`, `pod`, `zona`, `version`).
     */
    public static setContextoDefecto(contexto: IRespuestaContext): void {
        this.CONTEXTO_DEFECTO = Object.freeze({...contexto});
    }

    protected constructor(
        private readonly respuesta: ServerResponse,
        public errorHandler: IErrorHandler,
        protected readonly config: Net,
    ) {
        this.time = Date.now();
        this.contexto = Respuesta.CONTEXTO_DEFECTO;
        this.cacheTags = config.cacheTags.slice();
        this.responseHeaders = {};
        this.cacheControl = new Set<string>();
        this.vary = new Set<string>();
        this.data = null;
    }

    public abstract getHeaders(): IncomingHttpHeaders;
    public abstract transfiriendo(): void;
    public abstract terminado(): void;
    public abstract isTerminado(): boolean;
    protected abstract isCORS(): boolean;
    /**
     * Indica si la petición entrante es un `HEAD`. Las subclases lo implementan a
     * partir del método HTTP real. La base lo usa para construir cabeceras como en un
     * `GET` pero **omitir el cuerpo** según exige RFC 9110 §9.3.2.
     */
    protected abstract isHead(): boolean;

    /** Devuelve la instancia nativa de `ServerResponse` de Node.js. */
    public getRespuesta(): ServerResponse {
        return this.respuesta;
    }

    /**
     * Establece el código de estado HTTP de la respuesta.
     * Si no se llama, el código por defecto al enviar es `200`.
     */
    public setStatus(status: number): Respuesta {
        this.codigo = status;
        return this;
    }

    /**
     * Devuelve `true` si el código de estado es `2xx` o `3xx`, o si aún no se
     * ha fijado (se asumirá `200` al enviar).
     */
    public isOK(): boolean {
        return this.codigo === undefined || (this.codigo >= 200 && this.codigo < 400);
    }

    /**
     * Fija la fecha de expiración de caché a una fecha arbitraria.
     * Equivale a establecer la cabecera `Expires`.
     */
    public setCache(fecha: Date): Respuesta {
        this.cache = fecha;
        return this;
    }

    /** Fija la caché a 10 minutos desde ahora. */
    public setCache10Min(): Respuesta {
        this.cache = new Date(Date.now() + 600_000);
        return this;
    }

    /** Fija la caché a 1 hora desde ahora. */
    public setCache1Hora(): Respuesta {
        this.cache = new Date(Date.now() + 3_600_000);
        return this;
    }

    /** Fija la caché a 1 día desde ahora. */
    public setCache1Dia(): Respuesta {
        this.cache = new Date(Date.now() + 86_400_000);
        return this;
    }

    /** Fija la caché a 1 mes (30 días) desde ahora. */
    public setCache1Mes(): Respuesta {
        this.cache = new Date(Date.now() + 2_592_000_000);
        return this;
    }

    /** Fija la caché a 1 año (365 días) desde ahora. */
    public setCache1Anno(): Respuesta {
        this.cache = new Date(Date.now() + 31_536_000_000);
        return this;
    }

    /**
     * Devuelve la fecha de expiración de caché configurada, o la fecha actual
     * si no se ha establecido ninguna.
     */
    public getCache(): Date {
        return this.cache ?? new Date();
    }

    /**
     * Deshabilita la caché añadiendo `private, no-cache, no-store, must-revalidate`
     * al encabezado `Cache-Control` y eliminando la fecha de expiración.
     */
    public noCache(): Respuesta {
        this.cache = undefined;
        this.cacheControl.add("private");
        this.cacheControl.add("no-cache");
        this.cacheControl.add("no-store");
        this.cacheControl.add("must-revalidate");
        return this;
    }

    /**
     * Añade o elimina la directiva `no-transform` del encabezado `Cache-Control`.
     *
     * @param remove - Si es `true`, elimina la directiva; si es `false` (defecto), la añade.
     */
    public noTransform(remove: boolean = false): Respuesta {
        if (!remove) {
            this.cacheControl.add("no-transform");
        } else {
            this.cacheControl.delete("no-transform");
        }
        return this;
    }

    /** Añade la directiva `must-revalidate` al encabezado `Cache-Control`. */
    public mustRevalidate(): Respuesta {
        this.cacheControl.add("must-revalidate");
        return this;
    }

    /** Añade la directiva `proxy-revalidate` al encabezado `Cache-Control`. */
    public proxyRevalidate(): Respuesta {
        this.cacheControl.add("proxy-revalidate");
        return this;
    }

    /**
     * Añade la directiva `stale-while-revalidate` al encabezado `Cache-Control`.
     *
     * @param max - Tiempo máximo en segundos durante el que se puede servir la respuesta
     *              expirada mientras se revalida en segundo plano. Por defecto `0`.
     */
    public staleWhileRevalidate(max: number = 0): Respuesta {
        this.cacheControl.add(`stale-while-revalidate=${max}`);
        return this;
    }

    /**
     * Añade la directiva `stale-if-error` al encabezado `Cache-Control`.
     *
     * @param max - Tiempo máximo en segundos durante el que se puede servir la respuesta
     *              expirada si el servidor devuelve un error. Por defecto `0`.
     */
    public staleIfError(max: number = 0): Respuesta {
        this.cacheControl.add(`stale-if-error=${max}`);
        return this;
    }

    /**
     * Añade una etiqueta al encabezado `Cache-Tag` si no existe ya.
     * Las etiquetas permiten invalidación selectiva en CDNs compatibles.
     */
    public addCacheTag(tag: string): Respuesta {
        if (!this.cacheTags.includes(tag)) {
            this.cacheTags.push(tag);
        }
        return this;
    }

    /** Establece la fecha de última modificación del recurso (`Last-Modified`). */
    public setLastModified(fecha: Date): Respuesta {
        this.lastModified = fecha;
        return this;
    }

    /** Elimina la cabecera `Last-Modified` de la respuesta. */
    public unsetLastModified(): Respuesta {
        this.lastModified = undefined;
        return this;
    }

    /**
     * Establece el valor del encabezado `ETag`.
     *
     * @param etag   - Valor del ETag.
     * @param strong - Si es `true`, aplica comillas para indicar un ETag fuerte
     *                 (p. ej. `"abc123"`). Por defecto `false` (ETag débil).
     */
    public setETag(etag: string, strong = false): Respuesta {
        this.etag = strong ? `"${etag}"` : etag;
        return this;
    }

    /** Elimina el encabezado `ETag` de la respuesta. */
    public unsetETag(): Respuesta {
        this.etag = undefined;
        return this;
    }

    /** Establece el valor del encabezado `Content-Encoding` de forma libre. */
    public setContentEncoding(content: string): Respuesta {
        this.encoding = content;
        return this;
    }

    /** Establece `Content-Encoding: br` (Brotli). */
    public setContentEncodingBrotli(): Respuesta {
        this.encoding = "br";
        return this;
    }

    /** Establece `Content-Encoding: gzip`. */
    public setContentEncodingGzip(): Respuesta {
        this.encoding = "gzip";
        return this;
    }

    /** Establece `Content-Encoding: deflate`. */
    public setContentEncodingDeflate(): Respuesta {
        this.encoding = "deflate";
        return this;
    }

    /** Establece el valor del encabezado `Content-Type` de forma libre. */
    public setContentType(content: string): Respuesta {
        this.contentType = content;
        return this;
    }

    /** Establece `Content-Type: text/css`. */
    public setContentTypeCSS(): Respuesta {
        this.contentType = "text/css";
        return this;
    }

    /** Establece `Content-Type: text/plain`. Alias de {@link setContentTypeTextPlain}. */
    public setContentTypeText(): Respuesta {
        this.contentType = "text/plain";
        return this;
    }

    /** Establece `Content-Type: application/json; charset=UTF-8`. */
    public setContentTypeJSON(): Respuesta {
        this.contentType = "application/json; charset=UTF-8";
        return this;
    }

    /** Establece `Content-Type: application/octet-stream`. */
    public setContentTypeOctet(): Respuesta {
        this.contentType = "application/octet-stream";
        return this;
    }

    /**
     * Establece `Content-Type: text/html` con el charset indicado.
     *
     * @param charset - Charset a incluir en el tipo (p. ej. `"UTF-8"`).
     *                  Si es `null`, se omite el charset. Por defecto `"UTF-8"`.
     */
    public setContentTypeHTML(charset: string|null = "UTF-8"): Respuesta {
        this.contentType = charset !== null ?
            `text/html; charset=${charset}` :
            "text/html";
        return this;
    }

    /** Establece `Content-Type: application/javascript`. */
    public setContentTypeJavascript(): Respuesta {
        this.contentType = "application/javascript";
        return this;
    }

    /** Establece `Content-Type: image/svg+xml`. */
    public setContentTypeSVG(): Respuesta {
        this.contentType = "image/svg+xml";
        return this;
    }

    /** Establece `Content-Type: image/png`. */
    public setContentTypePNG(): Respuesta {
        this.contentType = "image/png";
        return this;
    }

    /** Establece `Content-Type: image/webp`. */
    public setContentTypeWebP(): Respuesta {
        this.contentType = "image/webp";
        return this;
    }

    /** Establece `Content-Type: image/jpeg`. */
    public setContentTypeJPG(): Respuesta {
        this.contentType = "image/jpeg";
        return this;
    }

    /** Establece `Content-Type: image/gif`. */
    public setContentTypeGif(): Respuesta {
        this.contentType = "image/gif";
        return this;
    }

    /** Establece `Content-Type: application/pdf`. */
    public setContentTypePDF(): Respuesta {
        this.contentType = "application/pdf";
        return this;
    }

    /** Establece `Content-Type: application/xml`. */
    public setContentTypeXML(): Respuesta {
        this.contentType = "application/xml";
        return this;
    }

    /** Establece `Content-Type: text/plain`. Alias de {@link setContentTypeText}. */
    public setContentTypeTextPlain(): Respuesta {
        this.contentType = "text/plain";
        return this;
    }

    /**
     * Establece el valor del encabezado `Content-Disposition`.
     * Útil para forzar la descarga de ficheros (`attachment; filename="file.pdf"`).
     */
    public setContentDisposition(contentDisposition: string): Respuesta {
        this.contentDisposition = contentDisposition;
        return this;
    }

    /**
     * Establece el valor del encabezado personalizado `X-Meteored-Pass`.
     * Identifica la pasada o capa que procesó la petición (p. ej. `"cdn"`, `"edge"`).
     */
    public setPasada(pasada: string): Respuesta {
        this.pasada = pasada;
        return this;
    }

    /** Añade un valor al encabezado `Vary`. */
    public addVary(vary: string): Respuesta {
        this.vary.add(vary);
        return this;
    }

    /** Añade `Accept-Encoding` al encabezado `Vary`. */
    public addVaryAcceptEncoding(): Respuesta {
        this.vary.add("Accept-Encoding");
        return this;
    }

    /** Añade `User-Agent` al encabezado `Vary`. */
    public addVaryUserAgent(): Respuesta {
        this.vary.add("User-Agent");
        return this;
    }

    /** Elimina todos los valores del encabezado `Vary`. */
    public unsetVary(): Respuesta {
        this.vary.clear();
        return this;
    }

    /** Establece el encabezado `Referrer-Policy` con el valor indicado. */
    public setReferrerPolicy(policy: TReferrerPolicy|string): Respuesta {
        this.responseHeaders["Referrer-Policy"] = policy;
        return this;
    }

    /** Elimina el encabezado `Referrer-Policy` de la respuesta. */
    public unsetRefererPolicy(): Respuesta {
        if ("Referrer-Policy" in this.responseHeaders) {
            delete this.responseHeaders["Referrer-Policy"];
        }
        return this;
    }

    /**
     * Añade o concatena un encabezado HTTP personalizado.
     * Si el encabezado ya existe, el nuevo valor se añade separado por coma.
     *
     * @param header - Nombre del encabezado HTTP.
     * @param value  - Valor a asignar o concatenar.
     */
    public addCustomHeader(header: string, value: string|number): Respuesta {
        if (!(header in this.responseHeaders)) {
            this.responseHeaders[header] = value;
        } else {
            this.responseHeaders[header] = `${this.responseHeaders[header]}, ${value}`;
        }
        return this;
    }

    /**
     * Envía una respuesta de error delegando en el `IErrorHandler` configurado.
     * Acepta los argumentos en cualquier orden: `(status, mensaje)` o `(mensaje, status)`.
     *
     * @param status  - Código de estado HTTP (por defecto `404`).
     * @param mensaje - Mensaje descriptivo del error (por defecto `"Not found"`).
     * @param extra   - Información adicional que puede usar el handler.
     */
    public async error(status?: number, mensaje?: string, extra?: unknown): Promise<number>;
    public async error(mensaje?: string, status?: number, extra?: unknown): Promise<number>;
    public async error(a?: string|number, b?: string|number, extra?: unknown): Promise<number> {
        let status: number;
        let mensaje: string;
        if (typeof a === "number") {
            status = a;
        } else if (typeof b === "number") {
            status = b;
        } else {
            status = 404;
        }
        if (typeof a === "string") {
            mensaje = a;
        } else if (typeof b === "string") {
            mensaje = b;
        } else {
            mensaje = "Not found";
        }
        return this.errorHandler.handleError(this, status, mensaje, extra);
    }

    /**
     * Envía una redirección HTTP.
     * Usa el código de estado ya fijado con `setStatus()` o `301` por defecto.
     *
     * @param location - URL de destino de la redirección.
     */
    public async redirect(location: string): Promise<number> {
        this.codigo = this.codigo ?? 301;
        this.location = location;
        return this.sendData(null);
    }

    /**
     * Serializa el objeto como JSON, aplica compresión si está habilitada en la
     * configuración y envía la respuesta con `Content-Type: application/json`.
     *
     * @param respuesta - Objeto a serializar y enviar.
     */
    public async sendRespuesta<T>(respuesta: T): Promise<number> {
        const buffer = Buffer.from(JSON.stringify(respuesta), "utf-8");
        if (!this.config.compress) {
            return this.sendData(buffer);
        }
        return this.sendDataCompress(buffer);
    }

    /**
     * Envía una respuesta HTML con `Content-Type: text/html; charset=UTF-8`,
     * aplicando compresión si está habilitada en la configuración.
     *
     * @param respuesta - Cadena HTML a enviar.
     */
    public async sendHTML(respuesta: string): Promise<number> {
        this.setContentTypeHTML();
        const buffer = Buffer.from(respuesta, "utf-8");
        if (!this.config.compress) {
            return this.sendData(buffer);
        }
        return this.sendDataCompress(buffer);
    }

    /**
     * Comprime `data` con el algoritmo preferido por el cliente (`br` > `gzip` > `deflate`)
     * **en streaming** (`zlib.createBrotliCompress/createGzip/createDeflate` + `pipeline`)
     * y envía la respuesta. Añade automáticamente `Accept-Encoding` al encabezado `Vary`.
     *
     * ### Cuándo se usa
     *
     * La compresión en Node **está deshabilitada por defecto** (`config.compress = false`)
     * y, en condiciones normales, no debería habilitarse en los servicios reales:
     *
     * - **Producción (GKE):** CloudFlare comprime en el edge y, si hace falta, Envoy/ASM
     *   puede comprimir en el sidecar con `envoy.filters.http.compressor`. Activar la
     *   compresión aquí gasta CPU en el pod sin beneficio (CloudFlare/Envoy recomprimen
     *   o sirven la respuesta tal cual).
     * - **Desarrollo local:** las peticiones llegan sin un proxy comprimidor delante.
     *   El único proyecto del monorepo que activa `compress: true` es el `proxy` de
     *   desarrollo, que termina TLS y enruta a varios servicios por dominio. Ese es el
     *   único caso de uso legítimo de este método.
     *
     * ### Por qué streaming
     *
     * La implementación previa hacía `await zlib.brotliCompress(buffer)`: necesitaba
     * el cuerpo completo en RAM, producía **otro buffer entero** con el resultado y
     * el TTFB esperaba a tener todo comprimido. Con `pipeline()` los chunks fluyen
     * del buffer al compresor al socket sin materializar la salida completa, lo que
     * reduce memoria y mejora el time-to-first-byte para respuestas grandes (típico
     * en el proxy de desarrollo cuando sirve bundles o HTML pesado).
     *
     * Se envía la respuesta con `Transfer-Encoding: chunked` (no se fija `Content-Length`
     * porque el tamaño comprimido se desconoce hasta terminar el stream).
     *
     * @param data - Buffer a comprimir y enviar.
     */
    public async sendDataCompress(data: Buffer): Promise<number> {
        const headers = this.getHeaders();
        this.addVaryAcceptEncoding();
        const acceptEncoding = headers["accept-encoding"];
        let compressor: zlib.BrotliCompress | zlib.Gzip | zlib.Deflate | null = null;
        if (typeof acceptEncoding === "string" && acceptEncoding.length > 0) {
            if (acceptEncoding.includes("br")) {
                compressor = zlib.createBrotliCompress();
                this.setContentEncodingBrotli();
            } else if (acceptEncoding.includes("gzip")) {
                compressor = zlib.createGzip();
                this.setContentEncodingGzip();
            } else if (acceptEncoding.includes("deflate")) {
                compressor = zlib.createDeflate();
                this.setContentEncodingDeflate();
            }
        }
        if (compressor === null) {
            return this.sendData(data);
        }

        if (this.isTerminado()) {
            compressor.destroy();
            return Promise.reject("Respuesta ya enviada");
        }
        this.transfiriendo();
        const codigo = this.enviarCabeceras();
        if (this.isHead()) {
            // HEAD: cerramos sin enviar cuerpo (RFC 9110 §9.3.2) y descartamos el
            // compresor para que no quede colgado.
            compressor.destroy();
            this.respuesta.end();
        } else {
            await pipeline(buffer2stream(data), compressor, this.respuesta);
        }
        this.terminado();

        return codigo;
    }

    /**
     * Envía una redirección permanente `301` a la URL indicada.
     *
     * @param location - URL de destino.
     */
    public async send301(location: string): Promise<number> {
        this.codigo = 301;
        this.responseHeaders["location"] = location;
        return this.sendData(null);
    }

    /**
     * Envía una respuesta `304 Not Modified` sin cuerpo.
     * Indica al cliente que puede usar su copia en caché.
     */
    public async send304(): Promise<number> {
        this.codigo = 304;
        return this.sendData(null);
    }

    /**
     * Establece el buffer de respuesta y desencadena el envío.
     *
     * @param respuesta - Buffer con el cuerpo, o `null` para respuestas sin cuerpo.
     */
    public async sendData(respuesta: Buffer|null): Promise<number> {
        this.length = respuesta !== null ? Buffer.byteLength(respuesta) : 0;
        this.data = respuesta;
        return this.responder();
    }

    /** Construye y escribe todas las cabeceras HTTP en el socket. Devuelve el código de estado. */
    private enviarCabeceras(): number {
        const status = this.codigo ?? 200;
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

        const expired = new Date(Date.now() - 3_600_000).toUTCString();
        if (this.cache) {
            const tiempo = Math.floor((this.cache.getTime() - Date.now()) / 1000);
            responseHeaders["Expires"] = tiempo > 0 ? this.cache.toUTCString() : expired;
        } else {
            responseHeaders["Expires"] = expired;
        }

        if (this.cacheControl.size > 0) {
            responseHeaders["Cache-Control"] = [...this.cacheControl];
        }
        if (this.cacheTags.length > 0) {
            responseHeaders["Cache-Tag"] = this.cacheTags;
        }
        if (this.etag) {
            responseHeaders["ETag"] = this.etag;
        }
        responseHeaders["Content-Type"] = this.contentType ?? "application/json; charset=UTF-8";
        if (this.contentDisposition) {
            responseHeaders["Content-Disposition"] = this.contentDisposition;
        }
        if (this.encoding) {
            responseHeaders["Content-Encoding"] = this.encoding;
        }
        if (this.vary.size > 0) {
            responseHeaders["Vary"] = [...this.vary];
        }
        responseHeaders["X-Meteored-Zone"] = this.contexto.zona;
        responseHeaders["X-Meteored-Service"] = this.contexto.service;
        responseHeaders["X-Meteored-Node"] = this.contexto.pod;
        responseHeaders["X-Meteored-Version"] = this.contexto.version;
        if (this.pasada) {
            responseHeaders["X-Meteored-Pass"] = this.pasada;
        }
        if (this.length) {
            responseHeaders["Content-Length"] = this.length;
        }
        // Default seguro: prevenir MIME-sniffing en cualquier respuesta.
        if (responseHeaders["X-Content-Type-Options"] === undefined) {
            responseHeaders["X-Content-Type-Options"] = "nosniff";
        }
        // Default seguro: para respuestas HTML aplicamos `Referrer-Policy`
        // moderadamente restrictivo si el handler no fijó uno explícitamente.
        // Para otros content-types lo omitimos para no afectar a APIs/imágenes.
        if (
            responseHeaders["Referrer-Policy"] === undefined
            && typeof responseHeaders["Content-Type"] === "string"
            && (responseHeaders["Content-Type"] as string).toLowerCase().startsWith("text/html")
        ) {
            responseHeaders["Referrer-Policy"] = TReferrerPolicy.STRICT_ORIGIN_WHEN_CROSS_ORIGIN;
        }

        this.respuesta.writeHead(status, responseHeaders);
        return status;
    }

    /** Orquesta el envío de cabeceras y cuerpo, gestionando el estado de la respuesta. */
    private async responder(): Promise<number> {
        if (this.isTerminado()) {
            if (this.isOK()) {
                return this.codigo ?? 0;
            }
            return Promise.reject("Respuesta ya enviada");
        }
        this.transfiriendo();
        const codigo = this.enviarCabeceras();

        if (this.data !== null && !this.isHead()) {
            await this.write(this.data);
        }
        this.respuesta.end();
        this.terminado();

        return codigo;
    }

    /**
     * Escribe el buffer en el socket en chunks de {@link CHUNK_SIZE} bytes,
     * respetando la back-pressure: espera el evento `drain` si el socket está lleno.
     *
     * @param data - Buffer completo a escribir.
     */
    private async write(data: Buffer): Promise<void> {
        const CHUNK_SIZE = Respuesta.CHUNK_SIZE;
        let offset = 0;

        while (offset < data.length) {
            const end = Math.min(offset + CHUNK_SIZE, data.length);
            const chunk = data.subarray(offset, end);
            const ok = this.respuesta.write(chunk);
            offset = end;

            if (!ok && offset < data.length) {
                await new Promise<void>(resolve => this.respuesta.once("drain", resolve));
            }
        }
    }

    /**
     * Envía una respuesta directamente desde la caché interna, omitiendo la
     * construcción de cabeceras habitual. Las cabeceras se toman del objeto `cache`.
     *
     * @param cache - Entrada de caché con código de estado y cabeceras precalculadas.
     * @param datos - Buffer con el cuerpo cacheado, o `null` si no hay cuerpo.
     */
    public async sendCache(cache: INetCache, datos: Buffer|null): Promise<number> {
        this.codigo = cache.code;
        this.responseHeaders = cache.headers;
        this.transfiriendo();

        this.respuesta.writeHead(cache.code, cache.headers);

        if (datos !== null && !this.isHead()) {
            this.respuesta.write(datos);
        }
        this.respuesta.end();
        this.terminado();

        return cache.code;
    }

    /**
     * Envía una respuesta cuyo cuerpo proviene de un stream legible,
     * usando `pipeline` para gestionar el flujo y evitar fugas de memoria.
     *
     * @param datos - Stream legible con el cuerpo de la respuesta.
     */
    public async sendStream(datos: NodeJS.ReadableStream): Promise<number> {
        if (this.isTerminado()) {
            return Promise.reject("Respuesta ya enviada");
        }
        this.transfiriendo();
        const codigo = this.enviarCabeceras();
        if (this.isHead()) {
            // En HEAD descartamos el stream sin enviarlo: cerramos la respuesta y
            // dejamos que el productor termine sin escribir al socket.
            const maybeDestroy = (datos as unknown as {destroy?: () => void}).destroy;
            if (typeof maybeDestroy === "function") {
                maybeDestroy.call(datos);
            }
            this.respuesta.end();
        } else {
            await pipeline(datos, this.respuesta);
        }
        this.terminado();

        return codigo;
    }

    /**
     * Reenvía la respuesta de una conexión upstream (`IncomingMessage`) al cliente,
     * propagando las cabeceras originales e inyectando los encabezados propios del
     * servicio (`x-meteored-service`, `x-meteored-node`, `x-meteored-node-chain`).
     *
     * @param datos - Respuesta HTTP upstream a reenviar.
     */
    public async forwardIncomingConnection(datos: IncomingMessage): Promise<number> {
        if (this.isTerminado()) {
            return Promise.reject("Respuesta ya enviada");
        }
        this.transfiriendo();

        const tags = datos.headers["cache-tag"];
        if (tags !== undefined) {
            this.cacheTags.push(tags as string);
        }

        let chain = datos.headers["x-meteored-node-chain"];
        if (chain === undefined) {
            chain = [];
        }
        if (!Array.isArray(chain)) {
            chain = [chain];
        }

        const padre = datos.headers["x-meteored-node"];
        if (padre !== undefined) {
            if (!Array.isArray(padre)) {
                chain.unshift(padre);
            } else {
                chain.unshift(...padre);
            }
        }

        const cabeceras = Respuesta.filtrarHopByHop(datos.headers);
        this.respuesta.writeHead(datos.statusCode as number, {
            ...cabeceras,
            "x-meteored-service": this.contexto.service,
            "x-meteored-node": this.contexto.pod,
            "x-meteored-node-chain": chain,
            "cache-tag": this.cacheTags,
        });
        if (this.isHead()) {
            datos.destroy();
            this.respuesta.end();
        } else {
            await pipeline(datos, this.respuesta);
        }
        this.terminado();

        return datos.statusCode as number;
    }

    /**
     * Filtra cabeceras hop-by-hop de una respuesta upstream según RFC 7230 §6.1,
     * incluyendo además las listadas en su propia cabecera `Connection`.
     *
     * @param headers - Cabeceras tal como llegan en la respuesta upstream.
     * @returns Copia de las cabeceras sin las hop-by-hop.
     */
    private static filtrarHopByHop(headers: IncomingHttpHeaders): OutgoingHttpHeaders {
        const extras: Set<string> = new Set<string>();
        const connHdr = headers["connection"];
        if (typeof connHdr === "string") {
            for (const nombre of connHdr.split(",")) {
                const limpio = nombre.trim().toLowerCase();
                if (limpio.length > 0) {
                    extras.add(limpio);
                }
            }
        }

        const salida: OutgoingHttpHeaders = {};
        for (const [nombre, valor] of Object.entries(headers)) {
            const lower = nombre.toLowerCase();
            if (Respuesta.HOP_BY_HOP.has(lower) || extras.has(lower)) {
                continue;
            }
            salida[nombre] = valor as OutgoingHttpHeaders[string];
        }
        return salida;
    }
}
