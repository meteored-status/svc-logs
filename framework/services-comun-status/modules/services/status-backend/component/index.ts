import {BackendRequest} from "services-comun/modules/net/request-backend";
import {EService, SERVICES} from "../../config";
import {RequestResponse} from "services-comun/modules/net/request";
import {ICurrentOUT} from "./current/interface";
import {IDeleteIN} from "./delete/interface";
import {logRejection} from "services-comun/modules/decorators/metodo";

export class Component extends BackendRequest {
    /* STATIC */
    private static SERVICIO: string = SERVICES.servicio(EService.status_backend).base;

    @logRejection(true)
    public static async current(token: string): Promise<RequestResponse<ICurrentOUT>> {
        return this.get<ICurrentOUT>(`${this.SERVICIO}/backend/component/current`,{auth: token});
    }

    @logRejection(true)
    public static async delete(token: string, data: IDeleteIN): Promise<RequestResponse<{}>> {
        return this.post<{}, IDeleteIN>(`${this.SERVICIO}/backend/component/delete`, data, {auth: token});
    }
}
