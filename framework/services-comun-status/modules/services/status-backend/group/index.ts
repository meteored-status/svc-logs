/**
 * Editor: Bixus
 * Fecha: Fri, 11 Sep 2026 09:36:01 GMT
 * Hash: e457958238347d62c78835f70a36fcda
 * Versión: 2026.9.11+1-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

import {BackendRequest, type RequestResponse} from "services-comun/modules/net/request-backend";
import {logRejection} from "services-comun/modules/decorators/metodo";

import {auditRequest} from "../audit/request";
import {EService, SERVICES} from "../../config";
import type {IDeleteIN} from "./delete/interface";
import type {IListOUT} from "./list/interface";
import type {IRolesIN} from "./roles/interface";
import type {ISaveIN} from "./save/interface";

export class Group extends BackendRequest {
    /* STATIC */
    private static SERVICIO: string = SERVICES.servicio(EService.status_backend).base;

    @logRejection(true)
    public static async list(token: string): Promise<RequestResponse<IListOUT>> {
        return this.get<IListOUT>(`${this.SERVICIO}/backend/group/list`, {auth: token});
    }

    @logRejection(true)
    public static async save(token: string, data: ISaveIN, auditPath: string): Promise<RequestResponse<{}>> {
        return this.post<{}, ISaveIN>(`${this.SERVICIO}/backend/group/save`, data, auditRequest(token, auditPath));
    }

    /**
     * Guarda los roles que concede el grupo. Aparte de `save()` porque lo gobierna otro permiso — ver
     * `IRolesIN`.
     */
    @logRejection(true)
    public static async roles(token: string, data: IRolesIN, auditPath: string): Promise<RequestResponse<{}>> {
        return this.post<{}, IRolesIN>(`${this.SERVICIO}/backend/group/roles`, data, auditRequest(token, auditPath));
    }

    // `remove` y no `delete`: `BackendRequest` ya tiene un estático `delete` (el verbo HTTP) y
    // sobrescribirlo con otra firma rompe la clase. Mismo criterio que los clientes de rol, usuario y dpto.
    @logRejection(true)
    public static async remove(token: string, data: IDeleteIN, auditPath: string): Promise<RequestResponse<{}>> {
        return this.post<{}, IDeleteIN>(`${this.SERVICIO}/backend/group/delete`, data, auditRequest(token, auditPath));
    }
}
