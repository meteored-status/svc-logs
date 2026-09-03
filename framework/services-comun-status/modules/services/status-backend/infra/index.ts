/**
 * Editor: Bixus
 * Fecha: Tue, 01 Sep 2026 11:32:26 GMT
 * Hash: 08164edc189a7640d746eb00a46105a9
 * Versión: 2026.9.1+2-bixus
 * Anterior: 2026.9.1+1-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

import {BackendRequest, RequestResponse} from "services-comun/modules/net/request-backend";
import {logRejection} from "services-comun/modules/decorators/metodo";

import {auditRequest} from "../audit/request";
import {EService, SERVICES} from "../../config";
import {IAnalisisOUT} from "./analisis/interface";
import {ICloudflareOUT} from "./cloudflare/interface";
import {ILimitDateIN, ILimitsOUT, ILimitsSaveIN} from "./limits/interface";
import {ISerieOUT} from "./serie/interface";

/**
 * Qué serie se pide para el detalle.
 *
 * @property metric - Qué métrica.
 * @property from   - Primer día, `YYYY-MM-DD`.
 * @property to     - Último día, `YYYY-MM-DD`.
 * @property zone   - Nombre de zona, para el desglose.
 */
interface ISerieConfig {
    metric: string;
    from: string;
    to: string;
    zone?: string;
}

/**
 * Qué recorte se pide.
 *
 * @property from - Primer día, `YYYY-MM-DD`. Por defecto, la ventana que la pantalla enseña de entrada.
 * @property to   - Último día, `YYYY-MM-DD`.
 * @property zone - Nombre de una zona, para pedir su desglose en vez del total de cuenta.
 */
interface ICloudflareConfig {
    from?: string;
    to?: string;
    zone?: string;
}

/**
 * La infraestructura: lo que se consume y lo que se ha contratado.
 *
 * El consumo es solo lectura —lo mete el cronjob `status-control`—, y los **límites** sí se escriben: viven en
 * `infra_limit`, versionados por fecha de efecto, y se editan desde el panel con `status.infra.edit`.
 */
export default class Index extends BackendRequest {
    /* STATIC */
    private static SERVICIO: string = SERVICES.servicio(EService.status_backend).base;

    /**
     * El consumo de Cloudflare del rango pedido.
     *
     * Sin `auditRequest`, igual que los listados de logs y por el mismo motivo: es una lectura que la pantalla
     * repite al cambiar de rango o de zona, y auditarla llenaría el registro de entradas que no dicen nada que
     * la auditoría de accesos no diga ya. Lo que sí lleva es permiso propio, `status.infra.view`, porque aquí
     * viajan las cifras del contrato con el proveedor.
     */
    @logRejection(true)
    public static async cloudflare(token: string, {from, to, zone}: ICloudflareConfig = {}): Promise<RequestResponse<ICloudflareOUT>> {
        const pares: [string, string|undefined][] = [["from", from], ["to", to], ["zone", zone]];
        const params = pares
            .filter((par): par is [string, string] => par[1] !== undefined && par[1].length > 0)
            .map(([clave, valor]) => `${clave}=${encodeURIComponent(valor)}`);
        const query = params.length > 0 ? `?${params.join("&")}` : "";

        return this.get<ICloudflareOUT>(`${this.SERVICIO}/backend/infra/cloudflare${query}`, {auth: token});
    }

    /**
     * Qué pasa en el consumo que merezca mirarse.
     *
     * Sin parámetros: la ventana la decide el análisis. Y sin `auditRequest`, como el resto de lecturas — lo pide la
     * portada de Infraestructura en cada visita, así que auditarlo llenaría el registro de entradas que no dicen
     * nada que la auditoría de accesos no diga ya.
     */
    @logRejection(true)
    public static async analisis(token: string): Promise<RequestResponse<IAnalisisOUT>> {
        return this.get<IAnalisisOUT>(`${this.SERVICIO}/backend/infra/analisis`, {auth: token});
    }

    /**
     * Una sola métrica sobre un rango cualquiera, para el detalle.
     *
     * Sin `auditRequest`: es una lectura, y el detalle la repite al cambiar de rango o de agrupación.
     */
    @logRejection(true)
    public static async serie(token: string, {metric, from, to, zone}: ISerieConfig): Promise<RequestResponse<ISerieOUT>> {
        const pares: [string, string|undefined][] = [["metric", metric], ["from", from], ["to", to], ["zone", zone]];
        const query = pares
            .filter((par): par is [string, string] => par[1] !== undefined && par[1].length > 0)
            .map(([clave, valor]) => `${clave}=${encodeURIComponent(valor)}`)
            .join("&");

        return this.get<ISerieOUT>(`${this.SERVICIO}/backend/infra/cloudflare/serie?${query}`, {auth: token});
    }

    /**
     * Las fechas de efecto con sus límites, más el catálogo de métricas.
     *
     * Sin `auditRequest`: es una lectura. Va con `status.infra.view` y no con `edit` porque son la otra mitad de lo
     * que la pantalla de consumo ya enseña — quien puede ver un 133% puede ver contra qué tope se calculó.
     */
    @logRejection(true)
    public static async limits(token: string): Promise<RequestResponse<ILimitsOUT>> {
        return this.get<ILimitsOUT>(`${this.SERVICIO}/backend/infra/limits`, {auth: token});
    }

    /**
     * Crea una fecha de efecto copiando los límites que rigen ese día.
     *
     * Con `auditRequest`, como todas las escrituras: cambiar lo contratado mueve todos los porcentajes de la
     * pantalla a la vez sin tocar ni un dato de consumo, así que hay que poder decir quién lo hizo.
     */
    @logRejection(true)
    public static async limitDate(token: string, data: ILimitDateIN, auditPath: string): Promise<RequestResponse<{}>> {
        return this.post<{}, ILimitDateIN>(`${this.SERVICIO}/backend/infra/limits/date`, data, auditRequest(token, auditPath));
    }

    /** Guarda los límites de una fecha de efecto. */
    @logRejection(true)
    public static async limitsSave(token: string, data: ILimitsSaveIN, auditPath: string): Promise<RequestResponse<{}>> {
        return this.post<{}, ILimitsSaveIN>(`${this.SERVICIO}/backend/infra/limits/save`, data, auditRequest(token, auditPath));
    }
}
