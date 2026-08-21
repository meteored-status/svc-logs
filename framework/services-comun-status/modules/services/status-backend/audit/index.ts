/**
 * Editor: Bixus
 * Fecha: Fri, 21 Aug 2026 06:11:54 GMT
 * Hash: 6626da11e94f540c16bccadbdcf77054
 * Versión: 2026.8.21+1-bixus
 * Anterior: 2026.8.20+1-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

import {BackendRequest, type RequestResponse} from "services-comun/modules/net/request-backend";
import {logRejection} from "services-comun/modules/decorators/metodo";

import {EService, SERVICES} from "../../config";
import type {IAvailableFiltersOUT} from "./available-filters/interface";
import type {IListOUT} from "./list/interface";
import type {IRegisterIN, IRegisterOUT} from "./register/interface";

/**
 * Filtros del listado de auditoría, ya convertidos.
 *
 * @property users   - Emails de los usuarios a incluir. Valores exactos: vale cualquiera de ellos.
 * @property paths   - Rutas a incluir, con el mismo criterio.
 * @property actions - Acciones a incluir (`EAuditAction`), con el mismo criterio.
 * @property tsFrom  - Límite inferior del instante del acceso, en milisegundos.
 * @property tsTo    - Límite superior del instante del acceso, en milisegundos.
 */
interface IListFilter {
    users?: string[];
    paths?: string[];
    actions?: string[];
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
    public static async availableFilters(token: string): Promise<RequestResponse<IAvailableFiltersOUT>> {
        return this.get<IAvailableFiltersOUT>(`${this.SERVICIO}/backend/audit/available-filters`, {auth: token});
    }

    @logRejection(true)
    public static async list(token: string, filters: IListFilter, pagination: IListPagination): Promise<RequestResponse<IListOUT>> {
        const params = new URLSearchParams();

        // Las listas van separadas por `;`, como en los clientes de logs. `URLSearchParams` se encarga de
        // escaparlas, que las rutas llevan barras y las hay con query string.
        if (filters.users !== undefined && filters.users.length > 0) {
            params.set("user", filters.users.join(";"));
        }

        if (filters.paths !== undefined && filters.paths.length > 0) {
            params.set("path", filters.paths.join(";"));
        }

        if (filters.actions !== undefined && filters.actions.length > 0) {
            params.set("action", filters.actions.join(";"));
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
