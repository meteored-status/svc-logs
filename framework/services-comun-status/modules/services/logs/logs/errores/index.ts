import {BackendRequest, RequestResponse} from "services-comun/modules/net/request-backend";
import {EService, SERVICES} from "../../../config";
import {logRejection} from "services-comun/modules/decorators/metodo";
import {IListOUT} from "./list/interface";
import {IAvaliableFiltersOUT} from "./available-filters/interface";
import {IDeleteIN, IDeleteOUT} from "./delete/interface";

interface ListFilter {
    projects: string[];
    services?: string[];
    files?: string[];
    lines?: number[];
    urls?: string[];
    tsFrom?: number;
    tsTo?: number;
}

interface ListPagination {
    page?: number;
    perPage?: number;
}

export default class Index extends BackendRequest {
    /* STATIC */
    private static SERVICIO = SERVICES.servicio(EService.logs).base;

    @logRejection(true)
    public static async list(filters: ListFilter, pagination: ListPagination): Promise<RequestResponse<IListOUT>> {
        let url = `${this.SERVICIO}/private/logs/error/list/`;

        const {projects} = filters;
        const {page, perPage} = pagination;

        const params: string[] = [];
        params.push(`projects=${projects.join(';')}`);

        if (filters.services !== undefined && filters.services.length > 0) {
            params.push(`services=${filters.services.join(';')}`);
        }

        if (filters.files !== undefined && filters.files.length > 0) {
            params.push(`files=${filters.files.join(';')}`);
        }

        if (filters.lines !== undefined && filters.lines.length > 0) {
            params.push(`lines=${filters.lines.join(';')}`);
        }

        if (filters.urls !== undefined && filters.urls.length > 0) {
            params.push(`urls=${filters.urls.join(';')}`);
        }

        if (filters.tsFrom) {
            params.push(`ts_from=${filters.tsFrom}`);
        }

        if (filters.tsTo) {
            params.push(`ts_to=${filters.tsTo}`);
        }

        if (page) {
            params.push(`page=${page}`);
            if (perPage) {
                params.push(`perPage=${perPage}`);
            }
        }

        if (params.length > 0) {
            url += `?${params.join('&')}`;
        }

        return await this.get<IListOUT>(url);
    }

    @logRejection(true)
    public static async availableFilters(projects: string[]): Promise<RequestResponse<IAvaliableFiltersOUT>> {
        const url = `${this.SERVICIO}/private/logs/error/available-filters/?projects=${projects.join(';')}`;
        return await this.get<IAvaliableFiltersOUT>(url);
    }

    @logRejection(true)
    public static async delete(post: IDeleteIN): Promise<RequestResponse<IDeleteOUT>> {
        const url = `${this.SERVICIO}/private/logs/error/delete/`;
        return await this.post<IDeleteOUT, IDeleteIN>(url, post);
    }

    /* INSTANCE */
}
