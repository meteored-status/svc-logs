/**
 * Editor: Bixus
 * Fecha: Fri, 21 Aug 2026 06:11:54 GMT
 * Hash: fb6caec28ee898cf7aac9d15dfc0987e
 * Versión: 2026.8.21+1-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

/**
 * Listado de logs de error del panel. Mismo criterio que el de servicio: sin `projects`, los pone el
 * backend a partir del usuario de la sesión.
 *
 * @property page    - Página pedida, empezando en 1.
 * @property perPage - Registros por página. Se recorta a `PER_PAGE_MAX`.
 * @property services - Servicios a incluir, separados por `;`.
 * @property urls     - URLs a incluir, separadas por `;`.
 * @property lines    - Líneas a incluir, separadas por `;`.
 * @property files    - Ficheros a incluir, separados por `;`.
 * @property ts_from  - Límite inferior del instante, en milisegundos.
 * @property ts_to    - Límite superior del instante, en milisegundos.
 */
export interface IListIN {
    page?: string;
    perPage?: string;
    services?: string;
    urls?: string;
    lines?: string;
    files?: string;
    ts_from?: string;
    ts_to?: string;
}

export type {IListOUT, ILog, ICtx} from "../../../../logs/logs/errores/list/interface";
