/**
 * Editor: Bixus
 * Fecha: Wed, 23 Sep 2026 08:46:25 GMT
 * Hash: e4be89d9bc6b84df41aee8e695e2994d
 * Versión: 2026.9.23+1-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

import type {RequestResponse} from "services-comun/modules/net/request-backend";
import {BackendRequest} from "services-comun/modules/net/request-backend";
import {logRejection} from "services-comun/modules/decorators/metodo";

import {EService, SERVICES} from "../../config";
import type {IToggleIN, IToggleOUT} from "./toggle/interface";
import type {IListOUT} from "./list/interface";

export class DisabledNotification extends BackendRequest {
    /* STATIC */
    private static SERVICIO: string = SERVICES.servicio(EService.status_backend).base;

    @logRejection(true)
    public static async toggle(token: string, data: IToggleIN): Promise<RequestResponse<IToggleOUT>> {
        return this.post<IToggleOUT, IToggleIN>(`${this.SERVICIO}/backend/disabled-notification/toggle/`,data, {auth: token});
    }

    @logRejection(true)
    public static async link(token:string): Promise<RequestResponse<IListOUT>> {
        return this.get<IListOUT>(`${this.SERVICIO}/backend/disabled-notification/list/`, {auth: token});
    }
}
