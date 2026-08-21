/**
 * Editor: Bixus
 * Fecha: Fri, 21 Aug 2026 06:11:54 GMT
 * Hash: 9e16f635ec4980016c1346226652abc4
 * Versión: 2026.8.21+1-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

/**
 * Listado de logs de servicio del panel.
 *
 * A diferencia del endpoint equivalente de `svc-logs` (`/private/logs/servicio/list/`), **no lleva
 * `projects`**: los proyectos que se consultan los decide el backend a partir de los departamentos del
 * usuario de la sesión. Era el punto flojo de la versión anterior — el filtro lo aplicaba el BFF de Next
 * y el servicio de logs se creía la lista que le llegara.
 *
 * @property page     - Página pedida, empezando en 1.
 * @property perPage  - Registros por página. Se recorta a `PER_PAGE_MAX`.
 * @property severity - Severidad exacta (`ESeverity`).
 * @property services - Servicios a incluir, separados por `;`.
 * @property types    - Tipos a incluir, separados por `;`.
 * @property ts_from  - Límite inferior del instante, en milisegundos.
 * @property ts_to    - Límite superior del instante, en milisegundos.
 */
export interface IListIN {
    page?: string;
    perPage?: string;
    severity?: string;
    services?: string;
    types?: string;
    ts_from?: string;
    ts_to?: string;
}

// La respuesta es la misma que ya publicaba `svc-logs`: se reexporta en vez de copiarse para que las dos
// no puedan divergir mientras las dos existan, y para que el panel no tenga que cambiar de tipos al
// cambiar de backend.
export type {IListOUT, ILog} from "../../../../logs/logs/servicios/list/interface";
