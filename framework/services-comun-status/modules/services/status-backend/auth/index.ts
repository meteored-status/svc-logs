import {BackendRequest, RequestResponse} from "services-comun/modules/net/request-backend";
import {EService, SERVICES} from "../../config";
import {ILoginIN, ILoginOUT} from "./login/interface";

export class Auth extends BackendRequest {
    /* STATIC */
    private static SERVICIO: string = SERVICES.servicio(EService.status_backend).base;

    public static async login(token: string, data: ILoginIN): Promise<RequestResponse<ILoginOUT>> {
        return this.post<ILoginOUT, ILoginIN>(`${this.SERVICIO}/backend/auth/login`, data, {auth: token});
    }
}
