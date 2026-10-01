/**
 * Editor: Bixus
 * Fecha: Fri, 11 Sep 2026 09:36:01 GMT
 * Hash: 4d831eb1e1ab0c49249eff3392854f19
 * Versión: 2026.9.11+1-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

import type {EGroupLevel} from "../interface";
import type {EUserStatus} from "../../user/interface";

/**
 * Listado de grupos del panel.
 *
 * @property groups               - Todos los grupos, ordenados por nombre.
 * @property memberCount          - Usuarios **distintos** que pertenecen a algún grupo. No es la suma de
 *                                  los `IGroup.memberCount`: quien está en dos grupos cuenta una vez aquí
 *                                  y dos en esa suma. Se calcula en el servidor por lo mismo que el de
 *                                  departamentos — `IGroup.members` viaja vacía sin `status.user.list`, y
 *                                  una cifra que cambia según el permiso de quien pregunta es peor en un
 *                                  resumen que una etiqueta imprecisa.
 * @property availableUsers       - Padrón completo de usuarios, para poder asignarlos sin una segunda
 *                                  petición. Llega **vacío** sin `status.user.list`, igual que
 *                                  `IGroup.members`: esto es el listado de usuarios y no lo abre el
 *                                  permiso de grupos. Vacío no significa «no hay usuarios», significa «no
 *                                  hay o no puedes verlos».
 * @property availableRoles      - Catálogo de roles que se pueden conceder desde un grupo, para ofrecerlos
 *                                  al editarlos. **Ya viene filtrado**: no salen los roles cuyos permisos
 *                                  efectivos incluyan alguno de `PERMISOS_NO_DELEGABLES` (`rolDelegable()`),
 *                                  porque un rol que se puede marcar y luego rechaza el backend es peor que
 *                                  uno que no se ofrece. Cada uno dice además si **quien pregunta** puede
 *                                  concederlo (`concedible`), que eso sí depende de la persona. Llega vacío
 *                                  sin `status.group.role.edit`, que es el único permiso con el que sirve de
 *                                  algo.
 */
export interface IListOUT {
    groups: IGroup[];
    memberCount: number;
    availableUsers: IGroupUser[];
    availableRoles: IGroupRolDisponible[];
}

/**
 * Grupo de usuarios del panel.
 *
 * @property id          - Identificador del grupo.
 * @property name        - Nombre visible, único en la tabla (`uq_user_group_name`).
 * @property description - Para qué es el grupo.
 * @property members     - Miembros **personas**, con su rango, ordenados por nombre. Llega **vacía** sin
 *                         `status.user.list`: saber quiénes son es ver el padrón, y eso no lo abre el
 *                         permiso de grupos.
 * @property memberGroups - Grupos que son miembros de este, con el rango con el que entraron. **Va
 *                         siempre**, al contrario que `members`: un grupo no es una persona, así que
 *                         enseñarlo no es ver el padrón y no lo tapa `status.user.list`.
 * @property memberCount - Cuántos miembros tiene. **Va siempre**, con permiso o sin él: es información
 *                         del grupo. Ojo, `members.length` **no** es esta cifra — sin `status.user.list`
 *                         la lista viene vacía y el contador sigue siendo correcto.
 * @property ownerCount  - Cuántas **personas** figuran como propietarias de forma directa. Va siempre y por
 *                         el mismo motivo, pero además hace falta para pintar la pantalla: es lo que dice si
 *                         quitar o degradar a un propietario va a dejar el grupo huérfano, y sin esta cifra
 *                         el diálogo tendría que deducirlo de `members`, que puede venir vacía.
 * @property ownerGroupCount - Cuántos **grupos** entraron como propietarios. Junto con `ownerCount` es lo que
 *                         sostiene el aviso de la pantalla: un grupo cuyo único propietario es otro grupo
 *                         sigue cumpliendo la regla —hay una arista de propietario— pero puede quedarse sin
 *                         **ninguna persona** que lo administre si ese grupo se vacía, y eso no lo impide
 *                         nadie: rechazar el vaciado de un grupo por lo que le pase a otro que no estás
 *                         mirando sería incomprensible. Así que se avisa en vez de prohibir.
 * @property roles       - Roles que concede el grupo, con el rango desde el que los concede. Viajan con
 *                         `status.group.list`, igual que los permisos de un rol viajan con
 *                         `status.rol.list`: saber qué abre un grupo es parte de saber qué es. Editarlos es
 *                         otra cosa y va con su propio permiso.
 * @property ownLevel    - Rango **efectivo** de quien pregunta dentro de este grupo, ausente si no es
 *                         miembro. Efectivo quiere decir que incluye el que le llega por anidamiento y que,
 *                         si llega por varios caminos, es el mayor (`gruposEfectivos()`). Es lo que permite
 *                         al panel ofrecer o no las acciones delegadas sin reimplementar las reglas: el
 *                         rango sale del servidor, que es quien tiene el grafo entero.
 */
export interface IGroup {
    id: number;
    name: string;
    description: string;
    members: IGroupMember[];
    memberGroups: IGroupNestedMember[];
    memberCount: number;
    ownerCount: number;
    ownerGroupCount: number;
    roles: IGroupRole[];
    ownLevel?: EGroupLevel;
}

/**
 * Miembro de un grupo.
 *
 * Mismos campos que `IDptoUser` más el rango, y como allí cada endpoint declara su propio contrato: no
 * se comparte el tipo para que el día que a uno le haga falta un campo más no se lo lleve el otro por
 * delante.
 *
 * @property id     - Identificador interno del usuario.
 * @property name   - Nombre visible.
 * @property email  - Email, único por usuario.
 * @property status - Estado de la cuenta (`EUserStatus`): un miembro pendiente o vetado sigue contando
 *                    como miembro y conservando su rango, pero no puede entrar al panel, así que los
 *                    permisos que le da el grupo no tienen efecto mientras lo esté.
 * @property level  - Rango dentro del grupo.
 */
export interface IGroupMember {
    id: number;
    name: string;
    email: string;
    status: EUserStatus;
    level: EGroupLevel;
}

/**
 * Rol concedido por un grupo.
 *
 * @property id       - Identificador del rol.
 * @property name     - Nombre del rol, que es con lo que se reconoce en la pantalla.
 * @property minLevel - Rango mínimo que lo recibe. Los rangos están anidados, así que un rol con `minLevel`
 *                      de administrador lo reciben también los propietarios.
 */
export interface IGroupRole {
    id: number;
    name: string;
    minLevel: EGroupLevel;
}

/**
 * Rol del catálogo, ofrecido para poder concederlo.
 *
 * No lleva `minLevel` —eso lo elige quien lo concede— y por eso es un tipo distinto de `IGroupRole`: un solo
 * tipo con el rango opcional dejaría que se colase un rol sin rango en la lista de los concedidos, que es
 * justo el dato que no puede faltar.
 *
 * @property id          - Identificador del rol.
 * @property name        - Nombre del rol.
 * @property description - Descripción del rol, para decidir si concederlo.
 * @property concedible  - Si **quien pregunta** puede concederlo: lo puede si tiene todos los permisos que el
 *                         rol concede, herencia incluida. Viene calculado del servidor, que es quien tiene la
 *                         cadena de padres, para que la pantalla pueda deshabilitarlo con su motivo en vez de
 *                         dejar marcarlo y que el backend lo rechace. Ojo, es distinto de estar en el
 *                         catálogo: los roles **no delegables** no llegan siquiera, porque eso no depende de
 *                         quién pregunte.
 */
export interface IGroupRolDisponible {
    id: number;
    name: string;
    description: string;
    concedible: boolean;
}

/**
 * Usuario del padrón, ofrecido para poder meterlo en un grupo.
 *
 * @property id     - Identificador interno del usuario.
 * @property name   - Nombre visible.
 * @property email  - Email.
 * @property status - Estado de la cuenta.
 */
export interface IGroupUser {
    id: number;
    name: string;
    email: string;
    status: EUserStatus;
}

/**
 * Un grupo que es miembro de otro.
 *
 * Lleva el nombre además del id, como `IGroupMember` lleva el suyo, para que la fila se pueda pintar sin
 * buscarlo en `IListOUT.groups`.
 *
 * @property id    - Identificador del grupo miembro.
 * @property name  - Nombre visible del grupo miembro.
 * @property level - Rango con el que entró. **Lo reciben todos sus miembros**, sea cual sea su rango dentro
 *                   de él: la arista sustituye el rango propio, no lo limita.
 */
export interface IGroupNestedMember {
    id: number;
    name: string;
    level: EGroupLevel;
}
