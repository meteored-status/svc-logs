import {BackendRequest} from "services-comun/modules/net/request-backend";
import {EService, SERVICES} from "../../config";
import {RequestResponse} from "services-comun/modules/net/request";
import {IStatusOUT} from "./status/interface";

export class CurrentStatus extends BackendRequest {
    /* STATIC */
    private static SERVICIO: string = SERVICES.servicio(EService.status_backend).base;

    public static async status(token: string): Promise<RequestResponse<IStatusOUT>> {
        return this.get<IStatusOUT>(`${this.SERVICIO}/backend/current-status/status`,{auth: token});
    }
}
