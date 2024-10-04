import {BackendRequest, RequestResponse} from "services-comun/modules/net/request-backend";
import {EService, SERVICES} from "../../config";
import {IGetUserServicesOUT} from "./user-services/interface";
import {logRejection} from "services-comun/modules/decorators/metodo";
import {ISaveIN, ISaveOUT} from "./save/interface";

export class Services extends BackendRequest {
    /* STATIC */
    private static SERVICIO = SERVICES.servicio(EService.status_backend).base;

    @logRejection(true)
    public static async getUserServices(token: string): Promise<RequestResponse<IGetUserServicesOUT>> {
        return await this.get<IGetUserServicesOUT>(`${this.SERVICIO}/backend/services/user-services`, {
            auth: token
        });
    }

    @logRejection(true)
    public static async save(token: string, data: ISaveIN): Promise<RequestResponse<ISaveOUT>> {
        return await this.post<ISaveOUT, ISaveIN>(`${this.SERVICIO}/backend/services/save`, data, {
            auth: token
        });
    }

    /* INSTANCE */
}
