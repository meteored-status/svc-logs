import {BackendRequest} from "services-comun/modules/net/request-backend";
import {EService, SERVICES} from "../../config";
import {RequestResponse} from "services-comun/modules/net/request";
import {IToggleIN, IToggleOUT} from "./toggle/interface";
import {IListOUT} from "./list/interface";
import {logRejection} from "services-comun/modules/decorators/metodo";

export class Subscription extends BackendRequest {
    /* STATIC */
    private static SERVICIO: string = SERVICES.servicio(EService.status_backend).base;

    @logRejection(true)
    public static async toggle(token: string, data: IToggleIN): Promise<RequestResponse<IToggleOUT>> {
        return this.post<IToggleOUT, IToggleIN>(`${this.SERVICIO}/backend/subscription/toggle/`,data, {auth: token});
    }

    @logRejection(true)
    public static async list(token:string): Promise<RequestResponse<IListOUT>> {
        return this.get<IListOUT>(`${this.SERVICIO}/backend/subscription/list/`, {auth: token});
    }
}
