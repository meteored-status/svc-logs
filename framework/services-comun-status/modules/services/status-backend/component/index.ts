import {BackendRequest} from "services-comun/modules/net/request-backend";
import {EService, SERVICES} from "../../config";
import {RequestResponse} from "services-comun/modules/net/request";
import {ICurrentOUT} from "./current/interface";

export class Component extends BackendRequest {
    /* STATIC */
    private static SERVICIO: string = SERVICES.servicio(EService.status_backend).base;

    public static async current(token: string): Promise<RequestResponse<ICurrentOUT>> {
        return this.get<ICurrentOUT>(`${this.SERVICIO}/backend/component/current`,{auth: token});
    }
}
