/**
 * Editor: José Antonio Jiménez
 * Fecha: Mon, 18 May 2026 11:31:45 GMT
 * Hash: 1fe1e58718dc150633313808c0d477b8
 * Versión: 2026.5.18+4-josantoniojimnez
 * Anterior: 2026.5.18+2-josantoniojimnez
 */

import type {Files} from "formidable";
import type {IncomingHttpHeaders, IncomingMessage, ServerResponse} from "node:http";
import type {URLSearchParams} from "node:url";
import tracer, {type Span} from "dd-trace";

import {ErrorCode, type IErrorInfo, type IOK, type IRespuestaKO, type IRespuestaOK} from "../../client/http/interface";
import type {IErrorHandler} from "./router";
import type {Idioma} from "./i18n";
import type {Net} from "./config/net";
import {RequestContext} from "./request-context";
import {Respuesta} from "./respuesta";
import type {TDevice} from "./config/device";

/** Métodos HTTP aceptados por el router. */
export type TMetodo = "ALL"|"GET"|"POST"|"PUT"|"DELETE"|"HEAD"|"OPTIONS"|"PATCH";

/**
 * Estado interno del ciclo de vida de la conexión.
 *
 * - `iniciando`     — Objeto creado; aún no procesado.
 * - `iniciado`      — Conexión registrada y lista para prepararse.
 * - `preparando`    — Procesando middleware y lógica de negocio.
 * - `transfiriendo` — Cabeceras enviadas; cuerpo en tránsito.
 * - `terminado`     — Respuesta completamente enviada al cliente.
 */
enum TStatus {
    iniciando,
    iniciado,
    preparando,
    transfiriendo,
    terminado,
}

/**
 * Representa una conexión HTTP entrante y su respuesta asociada.
 *
 * Compone:
 * - {@link RequestContext}: información inmutable de la petición (URL, headers,
 *   método, idioma, IP cliente, query, request id, dispositivo…).
 * - {@link Respuesta} (herencia legacy): builder de cabeceras y envío al socket.
 *
 * Toda la API pública de la versión anterior (accesos directos a `metodo`, `url`,
 * `dominio`, `idioma`, `post`, etc.) se mantiene mediante getters/setters que
 * delegan en {@link request}, por lo que los handlers existentes no requieren
 * cambios.
 */
export class Conexion extends Respuesta {

    /**
     * Construye una respuesta de éxito de la API con la estructura estándar `IRespuestaOK`.
     *
     * @param expiracion - Fecha de expiración de los datos. Por defecto la fecha actual.
     * @param data       - Datos a incluir en la respuesta.
     */
    public static buildRespuesta<T = undefined>({expiracion, data}: Partial<IOK<T>> = {}): IRespuestaOK<T|undefined> {
        expiracion ??= new Date();
        return {
            ok: true,
            expiracion: expiracion.getTime(),
            data,
        };
    }

    /**
     * Construye una respuesta de error de la API con la estructura estándar `IRespuestaKO`.
     *
     * @param data - Información parcial del error; se fusiona con los valores por defecto.
     */
    public static buildError(data?: Partial<IErrorInfo>): IRespuestaKO {
        return {
            ok: false,
            expiracion: new Date().getTime(),
            info: {
                code: ErrorCode.APPLICATION,
                message: "Error interno",
                ...data ?? {},
            },
        };
    }

    /**
     * @deprecated Usar `this.sendRespuesta(conexion)` en la implementación de `Group`.
     */
    public static baseDefecto<T = undefined>(expiracion?: Date, data?: T): IRespuestaOK<T|undefined> {
        return {
            ok: true,
            expiracion: (expiracion ?? new Date()).getTime(),
            data,
        };
    }

    /**
     * @deprecated Usar `this.sendError(conexion)` en la implementación de `Group`.
     */
    public static baseError(data?: Partial<IErrorInfo>): IRespuestaKO {
        return {
            ok: false,
            expiracion: new Date().getTime(),
            info: {
                code: ErrorCode.APPLICATION,
                message: "Error interno",
                ...data ?? {},
            },
        };
    }

    /** Contexto inmutable de la petición HTTP entrante. */
    public readonly request: RequestContext;

    private cors: boolean;
    private status: TStatus;

    /* ----- Delegados a `request` (compat. retro con la API previa) ----- */

    public get https(): boolean { return this.request.https; }
    public get start(): Date { return this.request.start; }
    public get path(): string { return this.request.path; }
    public get get(): string { return this.request.get; }
    public get dominio(): string { return this.request.dominio; }
    public get idioma(): Idioma { return this.request.idioma; }
    public get query(): URLSearchParams { return this.request.query; }
    public get queryRAW(): string { return this.request.queryRAW; }
    public get requestId(): string { return this.request.requestId; }
    public get metodo(): TMetodo { return this.request.metodo; }
    public get accept(): string { return this.request.accept; }
    public get userAgent(): string { return this.request.userAgent; }
    public get url(): string { return this.request.url; }
    public get ip(): string { return this.request.ip; }
    public get clientIp(): string { return this.request.clientIp; }
    public get ifModifiedSince(): Date|null { return this.request.ifModifiedSince; }
    public get ifNoneMatch(): string|null { return this.request.ifNoneMatch; }
    public get device(): TDevice { return this.request.device; }

    public get post(): NodeJS.Dict<any>|undefined { return this.request.post; }
    public set post(v: NodeJS.Dict<any>|undefined) { this.request.post = v; }

    public get postRAW(): string|undefined { return this.request.postRAW; }
    public set postRAW(v: string|undefined) { this.request.postRAW = v; }

    public get files(): Files|undefined { return this.request.files; }
    public set files(v: Files|undefined) { this.request.files = v; }

    public constructor(
        peticion: IncomingMessage,
        respuesta: ServerResponse,
        errorHandler: IErrorHandler,
        config: Net,
        https: boolean,
    ) {
        super(respuesta, errorHandler, config);

        this.request = new RequestContext(peticion, config, https);
        this.cors = this.request.get.startsWith("/web");
        this.status = TStatus.iniciando;

        this.addCustomHeader("X-Request-Id", this.request.requestId);
    }

    /**
     * Comprueba si el ETag proporcionado coincide con el `If-None-Match` del cliente.
     * Compara como ETag fuerte (con comillas).
     *
     * @param etag - Valor del ETag a comparar (sin comillas).
     */
    public checkETag(etag: string): boolean {
        return this.request.checkETag(etag);
    }

    /** Devuelve la instancia nativa `IncomingMessage` de la petición. */
    public getPeticion(): IncomingMessage {
        return this.request.peticion;
    }

    /** Habilita las cabeceras CORS (`Access-Control-Allow-Origin: *`) en la respuesta. */
    public enableCors(): Conexion {
        this.cors = true;
        return this;
    }

    /** Deshabilita las cabeceras CORS en la respuesta. */
    public disableCors(): Conexion {
        this.cors = false;
        return this;
    }

    protected isCORS(): boolean {
        return this.cors;
    }

    /**
     * Devuelve `true` cuando la petición entrante es `HEAD`. Permite a `Respuesta`
     * generar todas las cabeceras igual que en un `GET` pero **omitir el cuerpo**
     * conforme exige RFC 9110 §9.3.2.
     */
    protected isHead(): boolean {
        return this.request.metodo === "HEAD";
    }

    /**
     * Avanza el estado de `iniciando` → `iniciado`.
     * No tiene efecto si la conexión no está en estado `iniciando`.
     */
    public iniciado(): void {
        if (this.status === TStatus.iniciando) {
            this.status = TStatus.iniciado;
        }
    }

    /**
     * Avanza el estado de `iniciado` → `preparando`.
     * No tiene efecto si la conexión no está en estado `iniciado`.
     */
    public preparando(): void {
        if (this.status === TStatus.iniciado) {
            this.status = TStatus.preparando;
        }
    }

    /**
     * Avanza el estado de `preparando` → `transfiriendo`.
     * No tiene efecto si la conexión no está en estado `preparando`.
     */
    public transfiriendo(): void {
        if (this.status === TStatus.preparando) {
            this.status = TStatus.transfiriendo;
        }
    }

    /**
     * Avanza el estado de `transfiriendo` → `terminado`.
     * No tiene efecto si la conexión no está en estado `transfiriendo`.
     */
    public terminado(): void {
        if (this.status === TStatus.transfiriendo) {
            this.status = TStatus.terminado;
        }
    }

    /**
     * Devuelve `true` si la respuesta ya está siendo enviada o ha sido completada,
     * es decir, si el estado es `transfiriendo` o `terminado`.
     */
    public isTerminado(): boolean {
        return this.status >= TStatus.transfiriendo;
    }

    /** Devuelve las cabeceras HTTP de la petición entrante. */
    public getHeaders(): IncomingHttpHeaders {
        return this.request.headers;
    }

    /**
     * Devuelve el span de tracing actualmente activo (creado por la auto-instrumentación
     * HTTP de `dd-trace`) o `null` si no hay tracer cargado (entorno sin `DATADOG=true`).
     *
     * Los handlers pueden usarlo para añadir tags propios o crear spans hijo:
     *
     * ```ts
     * const span = conexion.getSpan();
     * span?.setTag("usuario.id", id);
     * ```
     */
    public getSpan(): Span | null {
        return tracer.scope().active();
    }

    /**
     * Renombra el span activo asignándole como `resource.name` el patrón de ruta
     * (`<MÉTODO> <resumen>`) y añadiendo el tag estándar `http.route`. Se invoca
     * desde el router cuando una expresión hace match, de modo que Datadog
     * agrupe las trazas por patrón de ruta en lugar de por URL concreta.
     *
     * Es seguro llamarlo aunque no haya span activo (no-op).
     */
    public setRoute(resumen: string): void {
        const span = tracer.scope().active();
        if (span !== null) {
            span.setTag("resource.name", `${this.request.metodo} ${resumen}`);
            span.setTag("http.route", resumen);
        }
    }

    /**
     * Parsea la query string de la petición con `qs` y la devuelve tipada.
     * Soporta arrays, objetos anidados y otros formatos extendidos de `qs`.
     *
     * @returns Objeto con los parámetros de la query string.
     */
    public getQuery<T = unknown>(): T {
        return this.request.getQuery<T>();
    }
}
