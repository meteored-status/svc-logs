import {BackendRequest, RequestResponse} from "services-comun/modules/net/request-backend";
import {EService, SERVICES} from "../../../config";
import {logRejection} from "services-comun/modules/decorators/metodo";
import {IListOUT} from "./list/interface";
import {ESeverity} from "../interface";

interface ListFilter {
    projects: string[];
    severity?: ESeverity;
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

    /* INSTANCE */
}
