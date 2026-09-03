/**
 * Editor: Bixus
 * Fecha: Wed, 02 Sep 2026 14:14:26 GMT
 * Hash: a81d8f446213dc8450fb7194508283be
 * Versión: 2026.9.2+1-bixus
 * Anterior: 2026.8.21+1-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

import {BackendRequest, RequestResponse} from "services-comun/modules/net/request-backend";
import {logRejection} from "services-comun/modules/decorators/metodo";

import {auditRequest} from "../audit/request";
import {EService, SERVICES} from "../../config";
import {IDeleteIN} from "./delete/interface";
import {ILangIN} from "./lang/interface";
import {IListOUT} from "./list/interface";
import {ISaveIN} from "./save/interface";

export class User extends BackendRequest {
    /* STATIC */
    private static SERVICIO: string = SERVICES.servicio(EService.status_backend).base;

    @logRejection(true)
    public static async list(token: string): Promise<RequestResponse<IListOUT>> {
        return this.get<IListOUT>(`${this.SERVICIO}/backend/user/list`, {auth: token});
    }

    /**
     * Cambia el idioma **del propio usuario**.
     *
     * Endpoint aparte de `save()` y no un campo más suyo, porque los dos permisos no tienen nada que ver: `save()`
     * pide `status.user.edit`, que es administrar a **otros**, y esto solo pide tener sesión. Metido dentro de
     * `save()`, cambiar tu propio idioma habría exigido permiso de administración de usuarios.
     *
     * Con `auditRequest`, como todas las escrituras.
     */
    @logRejection(true)
    public static async lang(token: string, data: ILangIN, auditPath: string): Promise<RequestResponse<{}>> {
        return this.post<{}, ILangIN>(`${this.SERVICIO}/backend/user/lang`, data, auditRequest(token, auditPath));
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
