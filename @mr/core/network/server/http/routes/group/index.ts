/**
 * Editor: José Antonio Jiménez
 * Fecha: Mon, 18 May 2026 10:42:05 GMT
 * Hash: 8a10665db22f9ffc44111b20bbcf4128
 * Versión: 2026.5.18+2-josantoniojimnez
 */

import type {Configuracion} from "services-comun/modules/utiles/config";
import {ErrorCode, type IErrorInfo, type IOK, type IRespuestaKO, type IRespuestaOK} from "@mr/core-network/client/http/interface";
import type {IWSHandler} from "@mr/core-network/server/websocket/handler";
import type {NetCache} from "services-comun/modules/net/cache";

import type {Checker} from "../../checkers";
import type {Conexion, TMetodo} from "../../conexion";
import type {IErrorHandler} from "../../router";
import {type IRouteGroup, RouteGroupBlock} from "./block";
import type {Respuesta} from "../../respuesta";

/**
 * Parámetros de visibilidad de un grupo de rutas.
 *
 * @property documentable - Si `false`, ninguna ruta del grupo aparece en la documentación generada.
 */
export interface IRouteGroupParams {
    documentable: boolean;
}

/**
 * Configuración de la respuesta de error en caché.
 *
 * @property cache  - Fecha de expiración de la respuesta de error en caché.
 * @property status - Código de estado HTTP de la respuesta de error.
 */
export interface IConfigError {
    cache: Date;
    status: number;
}

/**
 * Clase base abstracta para grupos de rutas HTTP.
 *
 * Un grupo encapsula una lista de {@link RouteGroupBlock} construidos a partir de
 * {@link getHandlers}. Gestiona el ciclo de vida completo: construcción de bloques,
 * comprobación de disponibilidad, enrutamiento y helpers para enviar respuestas
 * estandarizadas.
 *
 * ### Extensión
 * Las subclases deben implementar {@link getHandlers} devolviendo la lista de bloques
 * de rutas del grupo. Opcionalmente pueden sobreescribir {@link getWSHandlers} para
 * registrar handlers WebSocket asociados al mismo grupo.
 *
 * @template T - Tipo de configuración del servicio.
 */
export abstract class RouteGroup<T extends Configuracion = Configuracion> {

    /** Lista de bloques de rutas del grupo, ya construidos e inicializados. */
    private readonly handlers: RouteGroupBlock[];

    /** Parámetros de visibilidad del grupo. */
    public readonly params: IRouteGroupParams;

    /** Configuración del servicio, accesible por las subclases. */
    protected readonly configuracion: T;

    /**
     * `true` cuando todos los bloques del grupo están listos para recibir tráfico
     * (sus updaters, si los tienen, han completado la carga inicial de expresiones).
     */
    public get ok(): boolean {
        for (const actual of this.handlers) {
            if (!actual.ok) {
                return false;
            }
        }

        return true;
    }

    public constructor(configuracion: T, params?: Partial<IRouteGroupParams>) {
        this.configuracion = configuracion;
        this.handlers = this.getHandlers().map(actual => RouteGroupBlock.build(actual));
        this.params = {
            documentable: true,
            ...params,
        };
    }

    /**
     * Devuelve la lista de configuraciones de bloques de rutas del grupo.
     * Se invoca una sola vez en el constructor.
     */
    protected abstract getHandlers(): IRouteGroup[];

    /**
     * Devuelve los handlers WebSocket asociados a este grupo de rutas.
     * Por defecto devuelve un array vacío; las subclases pueden sobreescribirlo.
     */
    public getWSHandlers(): IWSHandler[] {
        return [];
    }

    /**
     * Devuelve las rutas documentables de todos los bloques del grupo.
     * Solo se incluyen los bloques cuyo flag `documentable` es `true`.
     */
    public getDocumentables(): Checker[] {
        const salida: Checker[] = [];
        for (const actual of this.handlers) {
            if (!actual.documentable) {
                continue;
            }
            salida.push(...actual.getDocumentables());
        }

        return salida;
    }

    /**
     * Evalúa los bloques del grupo en orden y delega al primero que haga match.
     * Si el bloque tiene `stop = true`, devuelve `false` para que el router
     * continúe evaluando el siguiente grupo.
     * @param conexion - Conexión HTTP entrante.
     * @returns `true` si algún bloque procesó la petición, `false` en caso contrario.
     */
    public async check(conexion: Conexion): Promise<boolean> {
        const metodo = conexion.metodo;

        for (const handler of this.handlers) {
            if (await handler.check(conexion, metodo)) {
                return !handler.stop;
            }
        }
        return false;
    }

    /**
     * Acumula en `allowed` los métodos HTTP que aceptaría cualquier bloque del grupo
     * para la URL/dominio/idioma/query de la conexión, ignorando el método entrante.
     * Usado por el router para construir la cabecera `Allow:` en respuestas `405`.
     */
    public collectAllowedMethods(conexion: Conexion, allowed: Set<TMetodo>): void {
        for (const handler of this.handlers) {
            handler.collectAllowedMethods(conexion, allowed);
        }
    }

    /**
     * Propaga la configuración de caché a todos los bloques del grupo.
     * @param cache - Instancia de caché de red compartida.
     */
    public setCache(cache: NetCache): void {
        for (const actual of this.handlers) {
            actual.setCache(cache);
        }
    }

    /**
     * Envía una respuesta exitosa estandarizada al cliente.
     *
     * Si `expiracion` está definida, aplica el header de caché correspondiente;
     * si no, añade `no-cache`. Si `etag` está definido y coincide con el `If-None-Match`
     * del cliente, devuelve un 304 sin cuerpo.
     *
     * @param conexion - Conexión HTTP activa.
     * @param opts     - Opciones de la respuesta: expiración, etag y datos.
     * @returns Código de estado HTTP enviado.
     */
    protected async sendRespuesta<TData = undefined>(conexion: Conexion, {expiracion, etag, data}: Partial<IOK<TData>> = {}): Promise<number> {
        if (expiracion === undefined) {
            expiracion = new Date();
            conexion.noCache();
        } else {
            conexion.setCache(expiracion);
        }
        if (etag !== undefined) {
            conexion.setETag(etag);
            if (conexion.ifNoneMatch === `"${etag}"`) {
                return conexion.send304();
            }
        }
        return conexion.sendRespuesta<IRespuestaOK<TData | undefined>>({
            ok: true,
            expiracion: expiracion.getTime(),
            data,
        });
    }

    /**
     * Envía una respuesta de error estandarizada al cliente.
     *
     * Si `cache` está definido, aplica el header de caché; si no, elimina toda
     * cabecera de caché. Si `status` está definido, lo aplica antes de enviar.
     *
     * @param conexion - Respuesta HTTP activa.
     * @param data     - Información adicional del error (código, mensaje, etc.).
     * @param opts     - Opciones: fecha de expiración de caché y código de estado HTTP.
     * @returns Código de estado HTTP enviado.
     */
    protected async sendError(conexion: Respuesta, data?: Partial<IErrorInfo>, {cache, status}: Partial<IConfigError> = {}): Promise<number> {
        if (cache === undefined) {
            conexion
                .noCache()
                .unsetETag()
                .unsetLastModified()
                .unsetVary();
        } else {
            conexion.setCache(cache);
        }
        if (status !== undefined) {
            conexion.setStatus(status);
        }

        return conexion.sendRespuesta<IRespuestaKO>({
            ok: false,
            expiracion: new Date().getTime(),
            info: {
                code: ErrorCode.APPLICATION,
                message: "Error interno",
                ...data ?? {},
            },
        });
    }
}

/**
 * Extensión de {@link RouteGroup} que implementa {@link IErrorHandler}.
 * Las subclases deben proporcionar la lógica concreta de manejo de errores HTTP
 * (p. ej. páginas de error personalizadas).
 *
 * @template T - Tipo de configuración del servicio.
 */
export abstract class RouteGroupError<T extends Configuracion = Configuracion> extends RouteGroup<T> implements IErrorHandler {
    /**
     * Gestiona un error HTTP enviando la respuesta adecuada al cliente.
     * @param conexion - Respuesta HTTP activa.
     * @param status   - Código de estado HTTP del error.
     * @param mensaje  - Mensaje descriptivo del error.
     * @param extra    - Información adicional opcional para depuración.
     */
    public abstract handleError(conexion: Respuesta, status: number, mensaje: string, extra?: unknown): Promise<number>;
}
