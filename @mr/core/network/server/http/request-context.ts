/**
 * Editor: José Antonio Jiménez
 * Fecha: Mon, 18 May 2026 11:31:45 GMT
 * Hash: f10ef3457b77ac9b45ccb5ced15cdb46
 * Versión: 2026.5.18+4-josantoniojimnez
 */

import type {Files} from "formidable";
import type {IncomingHttpHeaders, IncomingMessage} from "node:http";
import {parse} from "qs";
import type {IParseOptions} from "qs";
import {URL, type URLSearchParams} from "node:url";
import crypto from "node:crypto";
import querystring from "node:querystring";

import type {TMetodo} from "./conexion";
import {Idioma} from "./i18n";
import type {Net} from "./config/net";
import {TDevice} from "./config/device";

/**
 * Opciones seguras para `qs.parse` en query strings: limita profundidad de anidamiento,
 * número de parámetros y elementos por array, y rechaza claves `__proto__`/`constructor`
 * que podrían causar prototype-pollution.
 */
const QS_PARSE_OPTIONS: IParseOptions = {
    ignoreQueryPrefix: true,
    depth: 5,
    parameterLimit: 1000,
    arrayLimit: 200,
    allowPrototypes: false,
};

/**
 * Contexto inmutable de lectura de una petición HTTP entrante.
 *
 * Reúne todo lo que se puede consultar de la `IncomingMessage` (método, URL, headers,
 * idioma, IP cliente, identificador de petición, dispositivo detectado, query string)
 * sin exponer estado de respuesta. Está pensado para componerse desde {@link Conexion}.
 *
 * Las propiedades del cuerpo (`post`, `postRAW`, `files`) son mutables porque
 * `server.ts` las rellena después de parsear el body de la petición; el resto del
 * estado es de solo lectura.
 *
 * @property metodo     - Método HTTP (`GET` si no está definido).
 * @property https      - `true` si la conexión llega por TLS (o si `trustProxy` lo indica).
 * @property start      - Timestamp de inicio del procesamiento de la petición.
 * @property path       - Pathname sin decodificar tal y como llega en la URL.
 * @property get        - Pathname decodificado (sin percent-encoding) y sin prefijo de idioma.
 * @property url        - URL completa (`<proto>://<host><url>`).
 * @property dominio    - Host efectivo respetando `X-Forwarded-Host` si `trustProxy`.
 * @property idioma     - Idioma detectado a partir del pathname.
 * @property query      - Parámetros de la query string como `URLSearchParams`.
 * @property queryRAW   - Query string literal (incluye el `?` inicial).
 * @property requestId  - Identificador único de la petición (reutiliza `X-Request-Id` o genera uno).
 * @property clientIp   - IP cliente real (`X-Forwarded-For` con `trustProxy`, si no `socket.remoteAddress`).
 * @property accept     - Valor del header `Accept`.
 * @property userAgent  - Valor del header `User-Agent`.
 * @property post       - Cuerpo de la petición parseado.
 * @property postRAW    - Cuerpo de la petición sin parsear.
 * @property files      - Ficheros recibidos en `multipart/form-data`.
 */
export class RequestContext {

    public readonly peticion: IncomingMessage;
    public readonly https: boolean;
    public readonly start: Date;
    public readonly path: string;
    public readonly get: string;
    public readonly dominio: string;
    public readonly idioma: Idioma;
    public readonly query: URLSearchParams;
    public readonly queryRAW: string;
    public readonly requestId: string;

    public post?: NodeJS.Dict<any>;
    public postRAW?: string;
    public files?: Files;

    private readonly config: Net;
    private _device: TDevice|undefined;

    public get metodo(): TMetodo {
        return (this.peticion.method as TMetodo|undefined) ?? "GET";
    }

    public get accept(): string {
        return this.peticion.headers["accept"] ?? "";
    }

    public get userAgent(): string {
        return this.peticion.headers["user-agent"] ?? "";
    }

    /** URL completa de la petición incluyendo esquema, host y ruta. */
    public get url(): string {
        return `${this.https ? "https" : "http"}://${this.peticion.headers.host}${this.peticion.url}`;
    }

    /** Cabeceras HTTP de la petición entrante (referencia directa, no copia). */
    public get headers(): IncomingHttpHeaders {
        return this.peticion.headers;
    }

    /** Alias de {@link clientIp}; devuelve `"0.0.0.0"` si no se puede determinar. */
    public get ip(): string {
        return this.clientIp;
    }

    /**
     * IP cliente real resuelta teniendo en cuenta `config.trustProxy`.
     *
     * - Con `trustProxy = true` (producción detrás de Istio/ASM): se toma el primer
     *   valor de `X-Forwarded-For` (formato `client, proxy1, proxy2`) y, en su defecto,
     *   `X-Real-IP`.
     * - Con `trustProxy = false`: se devuelve `socket.remoteAddress`.
     */
    public get clientIp(): string {
        if (this.config.trustProxy) {
            const xff = this.peticion.headers["x-forwarded-for"];
            if (typeof xff === "string" && xff.length > 0) {
                const primero = xff.split(",")[0]?.trim();
                if (primero) {
                    return primero;
                }
            }
            const real = this.peticion.headers["x-real-ip"];
            if (typeof real === "string" && real.length > 0) {
                return real;
            }
        }
        return this.peticion.socket.remoteAddress ?? "0.0.0.0";
    }

    /**
     * Fecha del header `If-Modified-Since` de la petición previa,
     * o `null` si no está presente.
     */
    public get ifModifiedSince(): Date|null {
        const last = this.peticion.headers["if-modified-since"];
        if (last === undefined) {
            return null;
        }
        return new Date(last);
    }

    /**
     * Valor del header `If-None-Match` (ETag del cliente), o `null` si no está presente.
     */
    public get ifNoneMatch(): string|null {
        return this.peticion.headers["if-none-match"] ?? null;
    }

    /**
     * Tipo de dispositivo detectado a partir del header `cf-device-type` de Cloudflare
     * o, en su defecto, del `User-Agent`. Cacheado tras la primera llamada.
     */
    public get device(): TDevice {
        return this._device ??= this.detectarDevice();
    }

    public constructor(peticion: IncomingMessage, config: Net, https: boolean) {
        this.peticion = peticion;
        this.config = config;
        this.https = https;
        this.start = new Date();
        const url = new URL(`http://localhost${peticion.url ?? "/"}`);
        this.idioma = Idioma.build(url.pathname);
        this.get = querystring.unescape(this.idioma.path);
        this.post = {};
        this.files = {};
        this.query = url.searchParams;
        this.queryRAW = url.search;
        this.path = url.pathname;
        this.dominio = this.resolverDominio();
        this._device = undefined;

        const entrante = peticion.headers["x-request-id"];
        this.requestId = typeof entrante === "string" && entrante.length > 0
            ? entrante
            : crypto.randomUUID();
    }

    /**
     * Resuelve el host efectivo de la petición. Detrás de un proxy (`trustProxy = true`)
     * se prefiere `X-Forwarded-Host` si está presente; en caso contrario se cae al
     * `Host` original. Si no hay ninguno, devuelve cadena vacía.
     */
    private resolverDominio(): string {
        if (this.config.trustProxy) {
            const xfh = this.peticion.headers["x-forwarded-host"];
            if (typeof xfh === "string" && xfh.length > 0) {
                return xfh.split(",")[0]?.trim() ?? "";
            }
        }
        return this.peticion.headers.host ?? "";
    }

    /**
     * Detecta el tipo de dispositivo consultando primero la cabecera `cf-device-type`
     * de Cloudflare y, si no está disponible, analizando el `User-Agent` mediante
     * expresiones regulares.
     */
    private detectarDevice(): TDevice {
        const cf = this.peticion.headers["cf-device-type"];
        if (cf !== undefined) {
            switch (cf) {
                case "mobile":
                    return TDevice.mobile;
                case "tablet":
                    return TDevice.tablet;
            }
            return TDevice.desktop;
        }

        const ua = this.userAgent;
        if (/phone|windows\s+phone|ipod|blackberry|(?:android|bb\d+|meego|silk|googlebot) .+? mobile|palm|windows\s+ce|opera mini|avantgo|mobilesafari|docomo/i.exec(ua) !== null) {
            return TDevice.mobile;
        }
        if (/ipad|playbook|(?:android|bb\d+|meego|silk)(?! .+? mobile)/i.exec(ua) !== null) {
            return TDevice.tablet;
        }
        return TDevice.desktop;
    }

    /**
     * Comprueba si el ETag proporcionado coincide con el `If-None-Match` del cliente.
     * Compara como ETag fuerte (con comillas).
     *
     * @param etag - Valor del ETag a comparar (sin comillas).
     */
    public checkETag(etag: string): boolean {
        return this.ifNoneMatch === `"${etag}"`;
    }

    /**
     * Parsea la query string con `qs` aplicando los límites seguros configurados.
     */
    public getQuery<T = unknown>(): T {
        return parse(this.queryRAW, QS_PARSE_OPTIONS) as T;
    }
}

