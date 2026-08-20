/**
 * Editor: Bixus
 * Fecha: Thu, 20 Aug 2026 06:26:03 GMT
 * Hash: f721619ed8c4c99465126acca3ec9608
 * Versión: 2026.8.20+1-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

import {BackendRequest, type RequestResponse} from "services-comun/modules/net/request-backend";
import {logRejection} from "services-comun/modules/decorators/metodo";

import {EService, SERVICES} from "../../config";
import type {IListOUT} from "./list/interface";
import type {IRegisterIN, IRegisterOUT} from "./register/interface";

/**
 * Filtros del listado de auditoría, ya convertidos.
 *
 * @property user   - Texto a buscar en el nombre o el email del usuario.
 * @property path   - Texto a buscar en la ruta.
 * @property tsFrom - Límite inferior del instante del acceso, en milisegundos.
 * @property tsTo   - Límite superior del instante del acceso, en milisegundos.
 */
interface IListFilter {
    user?: string;
    path?: string;
    tsFrom?: number;
    tsTo?: number;
}

/**
 * Página pedida del listado de auditoría.
 *
 * @property page    - Página, empezando en 1.
 * @property perPage - Registros por página.
 */
interface IListPagination {
    page?: number;
    perPage?: number;
}

export class Audit extends BackendRequest {
    /* STATIC */
    private static SERVICIO: string = SERVICES.servicio(EService.status_backend).base;

    @logRejection(true)
    public static async register(token: string, data: IRegisterIN): Promise<RequestResponse<IRegisterOUT>> {
        return this.post<IRegisterOUT, IRegisterIN>(`${this.SERVICIO}/backend/audit/register`, data, {auth: token});
    }

    // La query string se monta con `URLSearchParams` y no concatenando, a diferencia de los clientes de
    // logs: aquí los dos filtros de texto son rutas y nombres de usuario, así que llevan `/`, `?`, `&`,
    // espacios y acentos. Concatenados sin escapar, un filtro por `/manager?x=1` se partiría en dos
    // parámetros y el backend recibiría otra cosa de la que se pidió.
    @logRejection(true)
    public static async list(token: string, filters: IListFilter, pagination: IListPagination): Promise<RequestResponse<IListOUT>> {
        const params = new URLSearchParams();

        if (filters.user !== undefined && filters.user.length > 0) {
            params.set("user", filters.user);
        }

        if (filters.path !== undefined && filters.path.length > 0) {
            params.set("path", filters.path);
        }

        if (filters.tsFrom !== undefined) {
            params.set("ts_from", `${filters.tsFrom}`);
        }

        if (filters.tsTo !== undefined) {
            params.set("ts_to", `${filters.tsTo}`);
        }

        if (pagination.page !== undefined) {
            params.set("page", `${pagination.page}`);
        }

        if (pagination.perPage !== undefined) {
            params.set("perPage", `${pagination.perPage}`);
        }

        const query = params.toString();
        const url = query.length > 0 ? `${this.SERVICIO}/backend/audit/list?${query}` : `${this.SERVICIO}/backend/audit/list`;

        return this.get<IListOUT>(url, {auth: token});
    }
}
