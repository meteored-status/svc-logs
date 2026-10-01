/**
 * Editor: Bixus
 * Fecha: Mon, 14 Sep 2026 07:03:21 GMT
 * Hash: baee41e0b4f1a04528d2d02e11a2633e
 * Versión: 2026.9.14+4-bixus
 * Anterior: 2026.9.14+1-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

/**
 * Listado de logs de servicio del panel.
 *
 * `projects` **no sustituye al permiso, lo acota**. El endpoint equivalente de `svc-logs`
 * (`/private/logs/servicio/list/`) se creía la lista que le llegara —el filtro lo aplicaba el BFF de Next—,
 * y ese era su punto flojo. Aquí el backend sigue resolviendo con los departamentos de la sesión qué
 * proyectos puede ver el usuario, y lo que llegue por aquí se **interseca** con esa lista: mandar uno
 * ajeno no lo añade, y mandar la lista vacía o no mandarla deja los suyos.
 *
 * @property page     - Página pedida, empezando en 1.
 * @property perPage  - Registros por página. Se recorta a `PER_PAGE_MAX`.
 * @property projects - Proyectos a incluir, separados por `;`. Subconjunto de los que puede ver el
 *                      usuario; lo que no esté entre los suyos se descarta.
 * @property severity - Severidad exacta (`ESeverity`).
 * @property entorno  - Entornos a incluir, separados por `;`: `0` desarrollo, `1` test, `2` producción
 *                      (el `EEntorno` de `@mr/core-log`). Lista y no valor único, al contrario que
 *                      `severity`, porque «lo que no es producción» es una pregunta razonable y son dos
 *                      valores.
 * @property services - Servicios a incluir, separados por `;`.
 * @property types    - Tipos a incluir, separados por `;`.
 * @property regions  - Zonas de despliegue a incluir, separadas por `;`.
 * @property hosts    - Máquinas o pods a incluir, separados por `;`.
 * @property ts_from  - Límite inferior del instante, en milisegundos.
 * @property ts_to    - Límite superior del instante, en milisegundos.
 */
export interface IListIN {
    projects?: string;
    page?: string;
    perPage?: string;
    severity?: string;
    entorno?: string;
    services?: string;
    types?: string;
    regions?: string;
    hosts?: string;
    ts_from?: string;
    ts_to?: string;
}

// La respuesta es la misma que ya publicaba `svc-logs`: se reexporta en vez de copiarse para que las dos
// no puedan divergir mientras las dos existan, y para que el panel no tenga que cambiar de tipos al
// cambiar de backend.
export type {IListOUT, ILog} from "../../../../logs/logs/servicios/list/interface";
