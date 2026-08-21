/**
 * Editor: Bixus
 * Fecha: Fri, 21 Aug 2026 06:11:54 GMT
 * Hash: 2828056d8c742e58a7cb4f1785c01328
 * Versión: 2026.8.21+1-bixus
 * Anterior: 2026.8.12+1-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

import {BackendRequest, RequestResponse} from "services-comun/modules/net/request-backend";
import {logRejection} from "services-comun/modules/decorators/metodo";

import {auditRequest} from "../audit/request";
import {EService, SERVICES} from "../../config";
import {IDeleteIN} from "./delete/interface";
import {IListOUT} from "./list/interface";
import {ISaveIN} from "./save/interface";

export class User extends BackendRequest {
    /* STATIC */
    private static SERVICIO: string = SERVICES.servicio(EService.status_backend).base;

    @logRejection(true)
    public static async list(token: string): Promise<RequestResponse<IListOUT>> {
        return this.get<IListOUT>(`${this.SERVICIO}/backend/user/list`, {auth: token});
    }

    @logRejection(true)
    public static async save(token: string, data: ISaveIN, auditPath: string): Promise<RequestResponse<{}>> {
        return this.post<{}, ISaveIN>(`${this.SERVICIO}/backend/user/save`, data, auditRequest(token, auditPath));
    }

    // `remove` y no `delete`: `BackendRequest` ya tiene un estático `delete` (el verbo HTTP) y
    // sobrescribirlo con otra firma rompe la clase. Mismo criterio que el cliente de
    // `logs/logs/errores`.
    @logRejection(true)
    public static async remove(token: string, data: IDeleteIN, auditPath: string): Promise<RequestResponse<{}>> {
        return this.post<{}, IDeleteIN>(`${this.SERVICIO}/backend/user/delete`, data, auditRequest(token, auditPath));
    }
}
