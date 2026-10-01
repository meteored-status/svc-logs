/**
 * Editor: Bixus
 * Fecha: Tue, 15 Sep 2026 08:43:57 GMT
 * Hash: 3b3be2f2b98ecfc608e710022a42d0f2
 * Versión: 2026.9.15+1-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

import {BackendRequest, type RequestResponse} from "services-comun/modules/net/request-backend";
import {logRejection} from "services-comun/modules/decorators/metodo";

import {auditRequest} from "../../audit/request";
import {EService, SERVICES} from "../../../config";
import type {IListOUT} from "./list/interface";
import type {ISaveIN} from "./save/interface";

/**
 * El catálogo de proyectos y servicios de los logs: qué hay y a qué grupos se reparte.
 *
 * Aparte de `Log` —el cliente de los dos listados— porque son dos cosas distintas con dos permisos
 * distintos: aquello es consultar los logs que a uno le tocan (`status.log.list`, lo tiene mucha gente) y
 * esto es decidir a quién le tocan (`status.service.catalog.*`, administración del panel).
 *
 * No hay `remove()`: del catálogo no se borra nada desde el panel. Lo que hay es lo que ha emitido alguna
 * vez, y una fila borrada volvería sola con el siguiente log —con sus grupos perdidos por el camino—.
 */
export class LogCatalog extends BackendRequest {
    /* STATIC */
    private static SERVICIO: string = SERVICES.servicio(EService.status_backend).base;

    @logRejection(true)
    public static async list(token: string): Promise<RequestResponse<IListOUT>> {
        return this.get<IListOUT>(`${this.SERVICIO}/backend/log/catalog/list`, {auth: token});
    }

    @logRejection(true)
    public static async save(token: string, data: ISaveIN, auditPath: string): Promise<RequestResponse<{}>> {
        return this.post<{}, ISaveIN>(`${this.SERVICIO}/backend/log/catalog/save`, data, auditRequest(token, auditPath));
    }
}
