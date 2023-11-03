import {FrontendRequest} from "services-comun/modules/net/request-frontend";
import {RequestResponse} from "services-comun/modules/net/request";
import {logRejection} from "services-comun/modules/decorators/metodo";

import {IPostSaveResource, IRespuestaIServiceResourceList, IToGuardian, IToStatus} from "./interface";
import dominio, {EDominio} from "../../portal/dominio";

export class StatusBackendFrontendRequest extends FrontendRequest {
    /* STATIC */
    private static SERVICIO: string = dominio.get(EDominio.status);

    @logRejection(true)
    public static async monitor(auth: string): Promise<RequestResponse<IToStatus[]>> {
        return await this.get<IToStatus[]>(`${this.SERVICIO}/web/status/monitor/`, {auth});
    }

    @logRejection(true)
    public static async guardian(): Promise<RequestResponse<IToGuardian>> {
        return await this.get<IToGuardian>(`${this.SERVICIO}/web/status/guardian/`, {});
    }

    @logRejection(true)
    public static async resourceList(auth: string): Promise<RequestResponse<IRespuestaIServiceResourceList>> {
        return await this.get<IRespuestaIServiceResourceList>(`${this.SERVICIO}/web/status/resource/list`, {auth});
    }

    @logRejection(true)
    public static async resourceSave(auth: string, json: IPostSaveResource): Promise<RequestResponse<void>> {
        return await this.postJSON<void, IPostSaveResource>(`${this.SERVICIO}/web/status/resource/save`, json, {auth});
    }

    /* INSTANCE */
}
