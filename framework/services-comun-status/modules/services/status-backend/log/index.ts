/**
 * Editor: Bixus
 * Fecha: Fri, 21 Aug 2026 06:11:54 GMT
 * Hash: 3f1e5119712c6a743fb24a527caf23f6
 * Versión: 2026.8.21+1-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

import {BackendRequest, RequestResponse} from "services-comun/modules/net/request-backend";
import {logRejection} from "services-comun/modules/decorators/metodo";

import {auditRequest} from "../audit/request";
import {EService, SERVICES} from "../../config";
import type {IAvaliableFiltersOUT as IErrorFiltersOUT} from "./error/available-filters/interface";
import type {IAvaliableFiltersOUT as IServicioFiltersOUT} from "./servicio/available-filters/interface";
import type {ICheckIN, ICheckOUT} from "./error/check/interface";
import type {IListOUT as IErrorListOUT} from "./error/list/interface";
import type {IListOUT as IServicioListOUT} from "./servicio/list/interface";
import {IUserLogErrorsOUT} from "./user-log-errors/interface";
import {IUserLogServicesOUT} from "./user-log-services/interface";

/**
 * Paginación de los dos listados de logs.
 *
 * @property page    - Página pedida, empezando en 1.
 * @property perPage - Registros por página. El backend la recorta a `PER_PAGE_MAX`.
 */
interface IPagination {
    page?: number;
    perPage?: number;
}

/**
 * Filtros del listado de logs de servicio. **Sin proyectos**: los pone el backend a partir del usuario
 * de la sesión.
 *
 * @property severity - Severidad exacta (`ESeverity`).
 * @property services - Servicios a incluir; vale cualquiera de ellos.
 * @property types    - Tipos a incluir; vale cualquiera de ellos.
 * @property tsFrom   - Límite inferior del instante, en milisegundos.
 * @property tsTo     - Límite superior del instante, en milisegundos.
 */
interface IServicioFilter {
    severity?: number;
    services?: string[];
    types?: string[];
    tsFrom?: number;
    tsTo?: number;
}

/**
 * Filtros del listado de logs de error. **Sin proyectos**, por lo mismo.
 *
 * @property services - Servicios a incluir.
 * @property files    - Ficheros a incluir.
 * @property lines    - Líneas a incluir.
 * @property urls     - URLs a incluir.
 * @property tsFrom   - Límite inferior del instante, en milisegundos.
 * @property tsTo     - Límite superior del instante, en milisegundos.
 */
interface IErrorFilter {
    services?: string[];
    files?: string[];
    lines?: number[];
    urls?: string[];
    tsFrom?: number;
    tsTo?: number;
}

/**
 * Monta la query string de un listado a partir de los pares con valor.
 *
 * Las listas van separadas por `;` y las vacías **no se mandan**: un `services=` suelto llegaría al
 * backend como un filtro que no casa con nada, que no es lo mismo que no filtrar por servicio.
 */
const query = (pares: [string, string|number|undefined][]): string => {
    const params = pares
        .filter((par): par is [string, string|number] => par[1] !== undefined && `${par[1]}`.length > 0)
        .map(([clave, valor]) => `${clave}=${encodeURIComponent(valor)}`);

    return params.length > 0 ? `?${params.join("&")}` : "";
}

/**
 * Une una lista para la query string, o `undefined` si no hay nada que mandar.
 */
const lista = (valores?: (string|number)[]): string|undefined => {
    return valores !== undefined && valores.length > 0 ? valores.join(";") : undefined;
}

export default class Index extends BackendRequest {
    /* STATIC */
    private static SERVICIO = SERVICES.servicio(EService.status_backend).base;

    @logRejection(true)
    public static async userLogServices(token: string): Promise<RequestResponse<IUserLogServicesOUT>> {
        return await this.get<IUserLogServicesOUT>(`${this.SERVICIO}/backend/log/user-log-services`, {
            auth: token
        });
    }

    @logRejection(true)
    public static async userLogErrors(token: string): Promise<RequestResponse<IUserLogErrorsOUT>> {
        return await this.get<IUserLogErrorsOUT>(`${this.SERVICIO}/backend/log/user-log-errors`, {
            auth: token
        });
    }

    @logRejection(true)
    public static async servicioList(token: string, filters: IServicioFilter, {page, perPage}: IPagination): Promise<RequestResponse<IServicioListOUT>> {
        const url = `${this.SERVICIO}/backend/log/servicio/list${query([
            ["severity", filters.severity],
            ["services", lista(filters.services)],
            ["types", lista(filters.types)],
            ["ts_from", filters.tsFrom],
            ["ts_to", filters.tsTo],
            ["page", page],
            ["perPage", perPage],
        ])}`;

        return await this.get<IServicioListOUT>(url, {
            auth: token
        });
    }

    @logRejection(true)
    public static async servicioAvailableFilters(token: string): Promise<RequestResponse<IServicioFiltersOUT>> {
        return await this.get<IServicioFiltersOUT>(`${this.SERVICIO}/backend/log/servicio/available-filters`, {
            auth: token
        });
    }

    @logRejection(true)
    public static async errorList(token: string, filters: IErrorFilter, {page, perPage}: IPagination): Promise<RequestResponse<IErrorListOUT>> {
        const url = `${this.SERVICIO}/backend/log/error/list${query([
            ["services", lista(filters.services)],
            ["files", lista(filters.files)],
            ["lines", lista(filters.lines)],
            ["urls", lista(filters.urls)],
            ["ts_from", filters.tsFrom],
            ["ts_to", filters.tsTo],
            ["page", page],
            ["perPage", perPage],
        ])}`;

        return await this.get<IErrorListOUT>(url, {
            auth: token
        });
    }

    @logRejection(true)
    public static async errorAvailableFilters(token: string): Promise<RequestResponse<IErrorFiltersOUT>> {
        return await this.get<IErrorFiltersOUT>(`${this.SERVICIO}/backend/log/error/available-filters`, {
            auth: token
        });
    }

    /**
     * Marca como revisados los logs de error que casen con el filtro.
     *
     * Lleva la pantalla del panel (`auditRequest`) porque el apunte se anota como `check`, y con la
     * cabecera queda registrado en `/logs-error` en vez de en el endpoint.
     */
    @logRejection(true)
    public static async errorCheck(token: string, data: ICheckIN, auditPath: string): Promise<RequestResponse<ICheckOUT>> {
        return await this.post<ICheckOUT, ICheckIN>(`${this.SERVICIO}/backend/log/error/check`, data, auditRequest(token, auditPath));
    }

}
