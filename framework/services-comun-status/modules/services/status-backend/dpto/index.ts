/**
 * Editor: Bixus
 * Fecha: Thu, 13 Aug 2026 11:53:20 GMT
 * Hash: 8cdf20f384b1a98c81e2c28e0a0a373f
 * Versión: 2026.8.13+2-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

import {BackendRequest, type RequestResponse} from "services-comun/modules/net/request-backend";
import {logRejection} from "services-comun/modules/decorators/metodo";

import {EService, SERVICES} from "../../config";
import type {IDeleteIN} from "./delete/interface";
import type {IListOUT} from "./list/interface";
import type {ISaveIN} from "./save/interface";

export class Dpto extends BackendRequest {
    /* STATIC */
    private static SERVICIO: string = SERVICES.servicio(EService.status_backend).base;

    @logRejection(true)
    public static async list(token: string): Promise<RequestResponse<IListOUT>> {
        return this.get<IListOUT>(`${this.SERVICIO}/backend/dpto/list`, {auth: token});
    }

    @logRejection(true)
    public static async save(token: string, data: ISaveIN): Promise<RequestResponse<{}>> {
        return this.post<{}, ISaveIN>(`${this.SERVICIO}/backend/dpto/save`, data, {auth: token});
    }

    // `remove` y no `delete`: `BackendRequest` ya tiene un estático `delete` (el verbo HTTP) y
    // sobrescribirlo con otra firma rompe la clase. Mismo criterio que los clientes de rol y usuario.
    @logRejection(true)
    public static async remove(token: string, data: IDeleteIN): Promise<RequestResponse<{}>> {
        return this.post<{}, IDeleteIN>(`${this.SERVICIO}/backend/dpto/delete`, data, {auth: token});
    }
}
