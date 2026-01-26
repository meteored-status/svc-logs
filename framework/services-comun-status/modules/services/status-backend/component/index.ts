import {BackendRequest, type RequestResponse} from "services-comun/modules/net/request-backend";
import {logRejection} from "services-comun/modules/decorators/metodo";

import {EService, SERVICES} from "../../config";
import type {ICurrentOUT} from "./current/interface";
import type {IDeleteIN} from "./delete/interface";

export class Component extends BackendRequest {
    /* STATIC */
    private static SERVICIO: string = SERVICES.servicio(EService.status_backend).base;

    @logRejection(true)
    public static async current(token: string): Promise<RequestResponse<ICurrentOUT>> {
        return this.get<ICurrentOUT>(`${this.SERVICIO}/backend/component/current`,{auth: token});
    }

    @logRejection(true)
    public static async remove(token: string, data: IDeleteIN): Promise<RequestResponse<{}>> {
        return this.post<{}, IDeleteIN>(`${this.SERVICIO}/backend/component/delete`, data, {auth: token});
    }
}
