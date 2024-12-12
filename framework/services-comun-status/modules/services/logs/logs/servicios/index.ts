import {BackendRequest, RequestResponse} from "services-comun/modules/net/request-backend";
import {EService, SERVICES} from "../../../config";
import {logRejection} from "services-comun/modules/decorators/metodo";
import {IListOUT} from "./list/interface";
import {ESeverity} from "../interface";
import {IAvaliableFiltersOUT} from "./available-filters/interface";

interface ListFilter {
    projects: string[];
    severity?: ESeverity;
    services?: string[];
    types?: string[];
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
        let url = `${this.SERVICIO}/private/logs/servicio/list/`;

        const {projects, severity} = filters;
        const {page, perPage} = pagination;

        const params: string[] = [];
        params.push(`projects=${projects.join(';')}`);

        if (severity !== undefined) {
            params.push(`severity=${severity}`);
        }

        if (filters.services !== undefined) {
            params.push(`services=${filters.services.join(';')}`);
        }

        if (filters.types !== undefined) {
            params.push(`types=${filters.types.join(';')}`);
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
        const url = `${this.SERVICIO}/private/logs/servicio/available-filters/?projects=${projects.join(';')}`;
        return await this.get<IAvaliableFiltersOUT>(url);
    }

    /* INSTANCE */
}
