/**
 * Editor: Bixus
 * Fecha: Thu, 13 Aug 2026 06:54:48 GMT
 * Hash: a556af35e6a1ddfe2eb926f0d0490297
 * Versión: 2026.8.13+1-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

import {BackendRequest, type RequestResponse} from "services-comun/modules/net/request-backend";
import {logRejection} from "services-comun/modules/decorators/metodo";

import {EService, SERVICES} from "../../config";
import type {IDeleteIN} from "./delete/interface";
import type {IListOUT} from "./list/interface";
import type {ISaveIN} from "./save/interface";

export class Rol extends BackendRequest {
    /* STATIC */
    private static SERVICIO: string = SERVICES.servicio(EService.status_backend).base;

    @logRejection(true)
    public static async list(token: string): Promise<RequestResponse<IListOUT>> {
        return this.get<IListOUT>(`${this.SERVICIO}/backend/rol/list`, {auth: token});
    }

    @logRejection(true)
    public static async save(token: string, data: ISaveIN): Promise<RequestResponse<{}>> {
        return this.post<{}, ISaveIN>(`${this.SERVICIO}/backend/rol/save`, data, {auth: token});
    }

    // `remove` y no `delete`: `BackendRequest` ya tiene un estático `delete` (el verbo HTTP) y
    // sobrescribirlo con otra firma rompe la clase. Mismo criterio que el cliente de usuarios.
    @logRejection(true)
    public static async remove(token: string, data: IDeleteIN): Promise<RequestResponse<{}>> {
        return this.post<{}, IDeleteIN>(`${this.SERVICIO}/backend/rol/delete`, data, {auth: token});
    }
}
