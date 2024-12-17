import {BackendRequest, RequestResponse} from "services-comun/modules/net/request-backend";
import {logRejection} from "services-comun/modules/decorators/metodo";
import {IUserLogServicesOUT} from "./user-log-services/interface";
import {EService, SERVICES} from "../../config";
import {IUserLogErrorsOUT} from "./user-log-errors/interface";

export default class Index extends BackendRequest {
    /* STATIC */
    private static SERVICIO = SERVICES.servicio(EService.status_backend).base;

    @logRejection(true)
    public static async userLogServices(token: string): Promise<RequestResponse<IUserLogServicesOUT>> {
        return await this.get<IUserLogServicesOUT>(`${this.SERVICIO}/backend/log/user-log-services`, {
            auth: token
        });
    }

    @logRejection(true)
    public static async userLogErrors(token: string): Promise<RequestResponse<IUserLogErrorsOUT>> {
        return await this.get<IUserLogErrorsOUT>(`${this.SERVICIO}/backend/log/user-log-errors`, {
            auth: token
        });
    }

}
