/**
 * Editor: Bixus
 * Fecha: Wed, 23 Sep 2026 08:46:25 GMT
 * Hash: 2dd5512d9577d2d37e66a946c0c54426
 * Versión: 2026.9.23+1-bixus
 * Anterior: 2026.9.9+1-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

import type {RequestResponse} from "services-comun/modules/net/request-backend";
import {BackendRequest} from "services-comun/modules/net/request-backend";
import {logRejection} from "services-comun/modules/decorators/metodo";

import {auditRequest} from "../../audit/request";
import {EService, SERVICES} from "../../../config";
import type {ISeoDescubrirOUT, ISeoProjectDeleteIN, ISeoProjectSaveIN, ISeoProjectsOUT} from "./interface";

/**
 * El catálogo de proyectos y subproyectos de SEO.
 *
 * Existe para dejar de inferir la lista del propio agregado: un `GROUP BY` sobre `logs.accesos_uri` costaba
 * 154 MiB de BigQuery en cada carga del panel de URLs, y daba una lista que no se puede ordenar ni renombrar.
 */
export default class Index extends BackendRequest {
    /* STATIC */
    private static SERVICIO: string = SERVICES.servicio(EService.status_backend).base;

    /**
     * El catálogo entero, incluidos los deshabilitados.
     *
     * Sin `auditRequest`: lo pide el desplegable del panel en cada visita, y auditarlo llenaría el registro de
     * entradas que no dicen nada que la auditoría de accesos no diga ya.
     */
    @logRejection(true)
    public static async lista(token: string): Promise<RequestResponse<ISeoProjectsOUT>> {
        return this.get<ISeoProjectsOUT>(`${this.SERVICIO}/backend/seo/projects`, {auth: token});
    }

    /**
     * Lo que hay en los logs y no está registrado.
     *
     * Se pide a mano desde la pantalla de gestión: es la única consulta a BigQuery de esta sección.
     */
    @logRejection(true)
    public static async descubrir(token: string): Promise<RequestResponse<ISeoDescubrirOUT>> {
        return this.get<ISeoDescubrirOUT>(`${this.SERVICIO}/backend/seo/projects/descubrir`, {auth: token});
    }

    /**
     * Crea o actualiza una entrada. Los campos que no se manden no se tocan.
     *
     * **Con `auditRequest`**, al contrario que las lecturas: cambia lo que ve todo el mundo —deshabilitar un
     * proyecto lo quita del desplegable de todos, y renombrarlo cambia cómo se lee un informe—.
     */
    @logRejection(true)
    public static async guardar(token: string, data: ISeoProjectSaveIN, auditPath: string): Promise<RequestResponse<{}>> {
        return this.post<{}, ISeoProjectSaveIN>(`${this.SERVICIO}/backend/seo/projects/save`, data, auditRequest(token, auditPath));
    }

    /** Borra una entrada. Para retirar un proyecto está `enabled`, no esto. */
    @logRejection(true)
    public static async borrar(token: string, data: ISeoProjectDeleteIN, auditPath: string): Promise<RequestResponse<{}>> {
        return this.post<{}, ISeoProjectDeleteIN>(`${this.SERVICIO}/backend/seo/projects/delete`, data, auditRequest(token, auditPath));
    }
}
