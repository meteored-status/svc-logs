/**
 * Editor: Bixus
 * Fecha: Fri, 21 Aug 2026 06:11:54 GMT
 * Hash: 7e14b8595dd4c324e7c88169c17acfbd
 * Versión: 2026.8.21+1-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

/**
 * Valores que pueden tomar los filtros del registro de auditoría.
 *
 * Se piden **una sola vez** y sin filtrar, no con cada consulta. Si las opciones se recortaran con lo ya
 * seleccionado, elegir un usuario dejaría fuera al resto y no habría forma de añadir un segundo — el
 * error clásico de los multi-select.
 *
 * @property users   - Usuarios que han accedido alguna vez, ordenados por nombre.
 * @property paths   - Rutas visitadas alguna vez, ordenadas alfabéticamente.
 * @property actions - Acciones que aparecen en el registro, ordenadas alfabéticamente.
 *
 *                     Salen del registro y no del enum `EAuditAction` para que la lista diga lo que hay
 *                     y no lo que podría haber: ofrecer una acción de la que no existe ni un apunte solo
 *                     sirve para que alguien la marque y se encuentre la tabla vacía. El precio es que
 *                     una acción nueva no aparece hasta que se ejecuta por primera vez, que es
 *                     exactamente lo que se quiere.
 */
export interface IAvailableFiltersOUT {
    users: IFilterUser[];
    paths: string[];
    actions: string[];
}

/**
 * Usuario como opción de filtro.
 *
 * Viajan los dos campos porque cada uno sirve para algo distinto: se **filtra** por email, que es lo
 * único único por usuario, y se **lee** el nombre, que es de lo que se acuerda quien busca.
 *
 * @property email - Email. Es el valor que hay que mandar en el filtro.
 * @property name  - Nombre para enseñar. Cae al email si el acceso no guardó ninguno.
 */
export interface IFilterUser {
    email: string;
    name: string;
}
