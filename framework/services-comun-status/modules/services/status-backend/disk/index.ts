/**
 * Editor: Bixus
 * Fecha: Fri, 04 Sep 2026 13:29:00 GMT
 * Hash: 5c7bcfd9d0b9bea04478e49d880afad2
 * Versión: 2026.9.4+3-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

import {BackendRequest, RequestResponse} from "services-comun/modules/net/request-backend";
import {logRejection} from "services-comun/modules/decorators/metodo";

import {EService, SERVICES} from "../../config";
import {IDiskListOUT, IDiskSerieOUT} from "./interface";

/**
 * Qué serie se pide.
 *
 * @property disk - Nombre del disco.
 * @property path - Ruta dentro del disco. `"/"` —el defecto— es el disco entero.
 * @property from - Primer día, `YYYY-MM-DD`.
 * @property to   - Último día, `YYYY-MM-DD`.
 */
interface ISerieConfig {
    disk: string;
    path?: string;
    from: string;
    to: string;
}

/**
 * La ocupación de los discos monitorizados.
 *
 * Solo lectura: las medidas las mete el servicio que las publica, por `POST /status/external/monitoring/disk/`, y
 * la capacidad de cada disco vive en `disk_capacity` y se rellena a mano —es un tamaño fijo, no una medida—.
 */
export default class Index extends BackendRequest {
    /* STATIC */
    private static SERVICIO: string = SERVICES.servicio(EService.status_backend).base;

    /**
     * Los discos con histórico, con lo que ocupaban en su última medida.
     *
     * Sin `auditRequest`, como el resto de lecturas de infraestructura: lo pide la pantalla en cada visita y
     * auditarlo llenaría el registro de entradas que no dicen nada que la auditoría de accesos no diga ya.
     */
    @logRejection(true)
    public static async lista(token: string): Promise<RequestResponse<IDiskListOUT>> {
        return this.get<IDiskListOUT>(`${this.SERVICIO}/backend/disk`, {auth: token});
    }

    /**
     * La evolución de un nodo en un rango, con el reparto de lo que tiene debajo.
     *
     * Sin `auditRequest`: es una lectura, y la pantalla la repite al cambiar de rango o al bajar una carpeta.
     */
    @logRejection(true)
    public static async serie(token: string, {disk, path, from, to}: ISerieConfig): Promise<RequestResponse<IDiskSerieOUT>> {
        const pares: [string, string|undefined][] = [["disk", disk], ["path", path], ["from", from], ["to", to]];
        const query = pares
            .filter((par): par is [string, string] => par[1] !== undefined && par[1].length > 0)
            .map(([clave, valor]) => `${clave}=${encodeURIComponent(valor)}`)
            .join("&");

        return this.get<IDiskSerieOUT>(`${this.SERVICIO}/backend/disk/serie?${query}`, {auth: token});
    }
}
