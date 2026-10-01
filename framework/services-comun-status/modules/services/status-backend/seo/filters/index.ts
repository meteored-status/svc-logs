/**
 * Editor: Bixus
 * Fecha: Wed, 23 Sep 2026 08:46:25 GMT
 * Hash: b30410ac2b07a6a0d63f652b4b4a4451
 * Versión: 2026.9.23+1-bixus
 * Anterior: 2026.9.10+1-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

import type {RequestResponse} from "services-comun/modules/net/request-backend";
import {BackendRequest} from "services-comun/modules/net/request-backend";
import {logRejection} from "services-comun/modules/decorators/metodo";

import {auditRequest} from "../../audit/request";
import {EService, SERVICES} from "../../../config";
import type {ISeoFilterDeleteIN, ISeoFilterSaveIN, ISeoFiltersOUT} from "./interface";

/**
 * Los filtros de URL guardados del panel de SEO.
 *
 * Compartidos y **por ámbito**: en `tiempo` se guardan por subproyecto —cada regional tiene sus secciones— y en
 * `mr` serán de todo el proyecto, así que al pedirlos se traen los del subproyecto más los de proyecto.
 */
export default class Index extends BackendRequest {
    /* STATIC */
    private static SERVICIO: string = SERVICES.servicio(EService.status_backend).base;

    /**
     * Los que aplican a un ámbito.
     *
     * Sin `auditRequest`: lo pide la pantalla cada vez que se cambia de proyecto, y auditarlo llenaría el
     * registro de entradas que no dicen nada que la auditoría de accesos no diga ya.
     */
    @logRejection(true)
    public static async lista(token: string, {proyecto, subproyecto}: {proyecto: string; subproyecto?: string}): Promise<RequestResponse<ISeoFiltersOUT>> {
        const pares: [string, string|undefined][] = [["project", proyecto], ["sub", subproyecto]];
        const query = pares
            .filter((par): par is [string, string] => par[1] !== undefined && par[1].length > 0)
            .map(([clave, valor]) => `${clave}=${encodeURIComponent(valor)}`)
            .join("&");

        return this.get<ISeoFiltersOUT>(`${this.SERVICIO}/backend/seo/filters?${query}`, {auth: token});
    }

    /**
     * Guarda uno, o corrige el que ya tenga esa descripción en ese ámbito.
     *
     * **Con `auditRequest`**: la lista la ve todo el mundo, así que guardar y borrar cambian lo que ven los demás.
     */
    @logRejection(true)
    public static async guardar(token: string, data: ISeoFilterSaveIN, auditPath: string): Promise<RequestResponse<{}>> {
        return this.post<{}, ISeoFilterSaveIN>(`${this.SERVICIO}/backend/seo/filters/save`, data, auditRequest(token, auditPath));
    }

    /** Borra uno por su id. */
    @logRejection(true)
    public static async borrar(token: string, data: ISeoFilterDeleteIN, auditPath: string): Promise<RequestResponse<{}>> {
        return this.post<{}, ISeoFilterDeleteIN>(`${this.SERVICIO}/backend/seo/filters/delete`, data, auditRequest(token, auditPath));
    }
}
