/**
 * Editor: Bixus
 * Fecha: Wed, 23 Sep 2026 08:46:25 GMT
 * Hash: 03e3b2eff7dc2202832ba89b3e272d47
 * Versión: 2026.9.23+1-bixus
 * Anterior: 2026.9.10+2-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

import type {RequestResponse} from "services-comun/modules/net/request-backend";
import {BackendRequest} from "services-comun/modules/net/request-backend";
import {logRejection} from "services-comun/modules/decorators/metodo";

import {auditRequest} from "../audit/request";
import {EService, SERVICES} from "../../config";
import type {IDiskCapacityDeleteIN, IDiskCapacitySaveIN, IDiskListOUT, IDiskSerieOUT} from "./interface";

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
 * La ocupación de los discos monitorizados, y la capacidad que se les apunta.
 *
 * **Las medidas no se escriben desde aquí**: las publica el servicio que las recoge, por
 * `POST /status/external/monitoring/disk/`. Lo que sí se edita es la capacidad (`disk_capacity`), que no es una
 * medida sino un tamaño fijo que alguien tiene que declarar — y hasta que hubo pantalla, se rellenaba a mano
 * con un `INSERT`.
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

    /**
     * Da de alta o corrige un escalón de capacidad.
     *
     * Con `auditRequest`, como todas las escrituras y con más motivo que la mayoría: cambiar la capacidad mueve
     * el porcentaje de ocupación y la fecha de llenado de toda la serie a la vez, **sin tocar ni una medida**.
     * Un disco que ayer estaba al 90% y hoy al 45% puede ser una ampliación real o una errata al teclear los
     * bytes, y desde los datos no se distingue: lo único que lo distingue es quién lo escribió y qué puso.
     */
    @logRejection(true)
    public static async capacitySave(token: string, data: IDiskCapacitySaveIN, auditPath: string): Promise<RequestResponse<{}>> {
        return this.post<{}, IDiskCapacitySaveIN>(`${this.SERVICIO}/backend/disk/capacity`, data, auditRequest(token, auditPath));
    }

    /**
     * Borra un escalón de capacidad.
     *
     * En `POST` y no en `DELETE` porque lleva cuerpo: la fila se identifica por dos campos, y meterlos en la
     * query dejaría el nombre del disco —con sus espacios y sus mayúsculas— en la URL y en los logs de acceso.
     * Es el mismo criterio que el resto de borrados del panel.
     */
    @logRejection(true)
    public static async capacityDelete(token: string, data: IDiskCapacityDeleteIN, auditPath: string): Promise<RequestResponse<{}>> {
        return this.post<{}, IDiskCapacityDeleteIN>(`${this.SERVICIO}/backend/disk/capacity/delete`, data, auditRequest(token, auditPath));
    }
}
