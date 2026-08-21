/**
 * Editor: Bixus
 * Fecha: Fri, 21 Aug 2026 06:11:54 GMT
 * Hash: d77dada909aedff7219429d9a3fdef6b
 * Versión: 2026.8.21+1-bixus
 * Anterior: 2026.8.13+1-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

import {BackendRequest, type RequestResponse} from "services-comun/modules/net/request-backend";
import {logRejection} from "services-comun/modules/decorators/metodo";

import {auditRequest} from "../audit/request";
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
    public static async save(token: string, data: ISaveIN, auditPath: string): Promise<RequestResponse<{}>> {
        return this.post<{}, ISaveIN>(`${this.SERVICIO}/backend/rol/save`, data, auditRequest(token, auditPath));
    }

    // `remove` y no `delete`: `BackendRequest` ya tiene un estático `delete` (el verbo HTTP) y
    // sobrescribirlo con otra firma rompe la clase. Mismo criterio que el cliente de usuarios.
    @logRejection(true)
    public static async remove(token: string, data: IDeleteIN, auditPath: string): Promise<RequestResponse<{}>> {
        return this.post<{}, IDeleteIN>(`${this.SERVICIO}/backend/rol/delete`, data, auditRequest(token, auditPath));
    }
}
