/**
 * Editor: Bixus
 * Fecha: Wed, 23 Sep 2026 08:46:25 GMT
 * Hash: f7808385bcdef7a60dcc7d3deed68e82
 * Versión: 2026.9.23+1-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

import type {RequestResponse} from "services-comun/modules/net/request-backend";
import {BackendRequest} from "services-comun/modules/net/request-backend";
import {logRejection} from "services-comun/modules/decorators/metodo";

import {EService, SERVICES} from "../../config";
import type {IGetUserServicesOUT} from "./user-services/interface";
import type {ISaveIN, ISaveOUT} from "./save/interface";

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
