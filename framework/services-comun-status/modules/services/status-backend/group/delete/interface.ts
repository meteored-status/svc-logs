/**
 * Editor: Bixus
 * Fecha: Fri, 11 Sep 2026 09:36:01 GMT
 * Hash: f6f77363672cbb0eb965e31bd1b4d466
 * Versión: 2026.9.11+1-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

/**
 * Grupo a borrar. El borrado es **físico** y se lleva por delante, en cascada, sus miembros y sus
 * permisos: las dos tablas son contenido del grupo, así que no hay nada que vaciar antes ni motivo para
 * impedirlo cuando tiene miembros — al contrario que un departamento, que sí se protege porque de él
 * cuelgan servicios y logs que no son suyos.
 *
 * Lo que sí desaparece con él es lo que concedía, así que quien pertenecía al grupo pierde esos permisos.
 * De ahí que borrar vaya con su propio permiso, `status.group.delete`.
 *
 * **Y que no se delegue: ser propietario del grupo no basta para borrarlo.** Es la única acción sobre un
 * grupo que no tiene vía delegada, al contrario que la gestión de miembros, y la asimetría es deliberada.
 * Un propietario administra a los suyos, pero borrar es irreversible y le quita permisos de golpe a gente
 * que no se enteró: un grupo es configuración del panel —como un rol— y no propiedad de quien lo lleva. Si
 * alguna vez se quiere delegar, el sitio es la tabla de rutas de `handlers/group.ts`, añadiendo un segundo
 * juego de permisos como hace `/backend/group/save`; hoy tiene uno solo a propósito.
 *
 * @property id - Identificador del grupo.
 */
export interface IDeleteIN {
    id: number;
}
