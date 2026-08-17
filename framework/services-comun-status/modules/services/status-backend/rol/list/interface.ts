/**
 * Editor: Bixus
 * Fecha: Thu, 13 Aug 2026 11:53:20 GMT
 * Hash: 05747c6b795db0bfb284bda1b552102c
 * Versión: 2026.8.13+2-bixus
 * Anterior: 2026.8.13+1-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

import type {ERolStatus} from "../interface";
import type {EUserStatus} from "../../user/interface";

/**
 * Listado de roles definidos en el panel.
 *
 * @property roles                - Todos los roles, en cualquier estado, ordenados por nombre. El
 *                                  filtrado por estado se hace en el cliente: el listado es la
 *                                  pantalla de administración de roles y tiene que poder verlos
 *                                  todos, incluidos los borrados.
 * @property availablePermissions - Catálogo completo de permisos, para poder ofrecerlos al editar
 *                                  un rol sin una segunda petición. Mismo criterio que
 *                                  `availableRoles` en el listado de usuarios.
 * @property availableUsers       - Padrón completo de usuarios, para poder asignarlos a un rol sin
 *                                  una segunda petición. Llega **vacío** si quien pide el listado no
 *                                  tiene `status.user.list`, igual que `IRol.users`: esto es el
 *                                  listado de usuarios, y no lo abre el permiso de roles. Ojo al
 *                                  pintarlo: vacío no significa «no hay usuarios», significa «no hay
 *                                  o no puedes verlos».
 */
export interface IListOUT {
    roles: IRol[];
    availablePermissions: IPermission[];
    availableUsers: IRolUser[];
}

/**
 * Rol del panel.
 *
 * Ojo, no confundir con `IRole` de `user/list/interface`: ese es el catálogo reducido que viaja
 * con el listado de usuarios para poder asignar roles sin una segunda petición, y no lleva
 * `parent`, `status` ni permisos.
 *
 * @property id          - Identificador del rol.
 * @property name        - Nombre visible.
 * @property description - Descripción del rol.
 * @property status      - Estado del rol (`ERolStatus`).
 * @property parent      - Identificador del rol del que hereda permisos (`role.parent`); ausente
 *                         si es un rol raíz. La herencia es transitiva: `Role.permissions()` sube
 *                         por toda la cadena de padres.
 * @property permissions - Permisos **efectivos** del rol, ordenados por id: los propios y los que
 *                         llegan por la cadena de padres, que es el conjunto que evalúa
 *                         `Auth().checkPermissions()`. Cada uno dice si es heredado. Ojo: se
 *                         calculan sin mirar el estado, así que un rol que no concede sigue
 *                         listando aquí lo que concedería si se habilitase.
 * @property users       - Usuarios que tienen el rol asignado de forma **directa**, ordenados por
 *                         nombre. No incluye a quienes reciban sus permisos por la jerarquía. Llega
 *                         **vacía** si quien pide el listado no tiene `status.user.list`: saber
 *                         quiénes son es ver el padrón, y eso no lo abre el permiso de roles.
 * @property userCount   - Cuántos usuarios lo tienen asignado de forma directa. **Va siempre**, con
 *                         permiso o sin él: es información del rol (a cuánta gente le cambia el acceso
 *                         si deja de conceder), no del padrón.
 *
 *                         Ojo: `users.length` **no** es el número de usuarios — sin
 *                         `status.user.list` la lista viene vacía y la cifra sigue siendo correcta.
 *                         Para contar, `userCount`; para enumerar, `users`.
 */
export interface IRol {
    id: number;
    name: string;
    description: string;
    status: ERolStatus;
    parent?: number;
    permissions: IRolPermission[];
    users: IRolUser[];
    userCount: number;
}

/**
 * Usuario que tiene un rol asignado.
 *
 * Ojo: estos datos viajan con el listado de roles, que solo exige `status.rol.list` — no
 * `status.user.list`. Es información de usuario expuesta por el permiso de roles.
 *
 * @property id     - Identificador interno del usuario.
 * @property name   - Nombre visible.
 * @property email  - Email, único por usuario.
 * @property status - Estado de la cuenta (`EUserStatus`): un rol asignado a una cuenta pendiente o
 *                    vetada no está concediendo nada a nadie, porque no puede entrar.
 */
export interface IRolUser {
    id: number;
    name: string;
    email: string;
    status: EUserStatus;
}

/**
 * Permiso que incorpora un rol.
 *
 * `id` es `string` y no `EPermission` a propósito: la tabla `permission` es la fuente de verdad y
 * puede contener ids que el enum todavía no declare (o al revés), así que tipar esto como el enum
 * daría por buenas garantías que la base de datos no ofrece.
 *
 * @property id          - Identificador del permiso.
 * @property description - Descripción del permiso.
 * @property inherited   - `true` si no es propio del rol, sino que llega por la cadena `parent`.
 */
export interface IRolPermission {
    id: string;
    description: string;
    inherited: boolean;
}

/**
 * Permiso del catálogo, tal como se ofrece al editar un rol.
 *
 * @property id          - Identificador del permiso.
 * @property description - Descripción del permiso.
 */
export interface IPermission {
    id: string;
    description: string;
}
