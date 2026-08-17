/**
 * Editor: Bixus
 * Fecha: Thu, 13 Aug 2026 11:53:20 GMT
 * Hash: a8b1d06e6364ed684478f9a2894c97e2
 * Versión: 2026.8.13+2-bixus
 * Anterior: 2026.8.13+1-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

import type {ERolStatus} from "../interface";

/**
 * Cambios a guardar en un rol, o los datos de uno nuevo.
 *
 * @property id          - Identificador del rol a modificar. **Ausente da de alta un rol nuevo**, y
 *                         MySQL le asigna el id (`role.id` es auto_increment). Mismo criterio que
 *                         `Usuario.save()`, que inserta o actualiza según tenga id o no.
 * @property name        - Nombre visible.
 * @property description - Descripción del rol.
 * @property status      - Estado del rol (`ERolStatus`). Es también la vía para deprecar: se
 *                         guarda `DEPRECATED` sin tocar nada más. `DELETED` **se rechaza** si el rol
 *                         no lo estaba ya: borrar exige `status.rol.delete` y va por
 *                         `/backend/rol/delete`. Restaurar uno borrado sí se hace desde aquí, porque
 *                         el estado al que pasa no es `DELETED`.
 * @property parent      - Rol del que hereda; `null` lo deja como rol raíz. **Solo se aplica al dar
 *                         de alta**: la herencia no se puede cambiar después, así que al editar hay
 *                         que mandar el que el rol ya tiene o se rechaza la petición. Mover un rol de
 *                         sitio alteraría de golpe los permisos efectivos de todos sus descendientes
 *                         y de sus usuarios.
 * @property permissions - Permisos **propios** del rol. La lista llega completa y sustituye a la
 *                         anterior, así que una lista vacía se los quita todos. Los heredados no
 *                         se envían: se quitan desde el rol padre.
 * @property users       - Usuarios con el rol asignado de forma **directa**. La lista llega completa y
 *                         sustituye a la anterior. **Omitirla deja las asignaciones como están**, que
 *                         es lo que hay que hacer si no se quieren tocar: mandarla vacía se lo quita
 *                         a todo el mundo. Cambiar asignaciones exige `status.user.edit` **además**
 *                         de `status.rol.edit` — es el mismo permiso que pide asignar roles desde la
 *                         ficha del usuario, y sin eso el permiso de roles serviría para dar acceso a
 *                         terceros. Los usuarios que reciben el rol por herencia no se envían: se
 *                         quitan desde el rol que se lo da.
 */
export interface ISaveIN {
    id?: number;
    name: string;
    description: string;
    status: ERolStatus;
    parent: number|null;
    permissions: string[];
    users?: number[];
}
