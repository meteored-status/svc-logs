/**
 * Editor: Bixus
 * Fecha: Wed, 23 Sep 2026 08:46:25 GMT
 * Hash: 61742cd4a0f0e8548890dc0e246dacc2
 * Versión: 2026.9.23+1-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

import type {RequestResponse} from "services-comun/modules/net/request-backend";
import {BackendRequest} from "services-comun/modules/net/request-backend";

import {EService, SERVICES} from "../../config";
import type {IStatusOUT} from "./status/interface";

export class CurrentStatus extends BackendRequest {
    /* STATIC */
    private static SERVICIO: string = SERVICES.servicio(EService.status_backend).base;

    public static async status(token: string): Promise<RequestResponse<IStatusOUT>> {
        return this.get<IStatusOUT>(`${this.SERVICIO}/backend/current-status/status`,{auth: token});
    }
}
