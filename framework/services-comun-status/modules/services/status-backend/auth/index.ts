import {BackendRequest} from "services-comun/modules/net/request-backend";
import {EService, SERVICES} from "../../config";
import {IPostLogin} from "../../status-auth/interface";
import {RequestResponse} from "services-comun/modules/net/request";
import {ILoginOUT} from "./login/interface";

export class Auth extends BackendRequest {
    /* STATIC */
    private static SERVICIO: string = SERVICES.servicio(EService.status_backend).base;

    public static async login(token: string, data: IPostLogin): Promise<RequestResponse<ILoginOUT>> {
        return this.post<ILoginOUT, IPostLogin>(`${this.SERVICIO}/backend/auth/login`, data, {auth: token});
    }
}
