/**
 * Editor: Bixus
 * Fecha: Tue, 15 Sep 2026 08:43:57 GMT
 * Hash: 5da3db8079608a3604be1a6ba7e82602
 * Versión: 2026.9.15+1-bixus
 * Anterior: 2026.9.11+2-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

import type {EGroupLevel} from "../../group/interface";
import type {ERolStatus} from "../../rol/interface";
import type {EUserStatus} from "../interface";

/**
 * Listado de usuarios registrados en el panel.
 *
 * @property users          - Todos los usuarios, activados o no, ordenados por nombre.
 * @property availableRoles       - Catálogo completo de roles, para poder ofrecerlos al editar un
 *                                  usuario sin una segunda petición. Los roles de cada usuario van en
 *                                  `IUser.roles`.
 * @property availableDepartments - Catálogo completo de departamentos, mismo criterio. Sale de la tabla
 *                                  `department`, que es la fuente de la verdad desde que los
 *                                  departamentos se administran desde el panel: el enum `EDepartment`
 *                                  del framework ya **no** es la lista completa —solo los ids que
 *                                  conoce el código—, así que quien ofrezca departamentos tiene que
 *                                  usar esto y no el enum.
 */
export interface IListOUT {
    users: IUser[];
    availableRoles: IRole[];
    availableDepartments: IDepartment[];
}

/**
 * Rol asignable a un usuario.
 *
 * El catálogo llega **completo**, con los roles en cualquier estado, borrados incluidos: si un rol
 * desapareciese de aquí, el diálogo de edición no pintaría su casilla y al guardar —`ISaveIN.roles`
 * llega completa y sustituye— se lo quitaría al usuario sin avisar. Quien lo pinte es responsable de
 * distinguirlos por `status`.
 *
 * @property id          - Identificador del rol.
 * @property name        - Nombre visible.
 * @property description - Descripción del rol.
 * @property status      - Estado del rol (`ERolStatus`). Ojo: `DISABLED` y `DELETED` no conceden sus
 *                         permisos, así que asignarlos no da acceso a nada; `DEPRECATED` sí concede.
 */
export interface IRole {
    id: number;
    name: string;
    description: string;
    status: ERolStatus;
}

/**
 * Departamento asignable a un usuario.
 *
 * @property id   - Identificador del departamento.
 * @property name - Nombre visible.
 */
export interface IDepartment {
    id: number;
    name: string;
}

/**
 * Usuario del panel.
 *
 * @property id          - Identificador interno (`user.id`), no el UID de Firebase.
 * @property name        - Nombre visible.
 * @property email       - Email, único por usuario.
 * @property status      - Estado de la cuenta (`EUserStatus`). El login crea las altas como
 *                         `PENDING`, así que el listado incluye altas sin activar, y los vetados
 *                         siguen apareciendo como `BANNED`.
 * @property onCallRotation - Si el usuario está en la rueda de la guardia (*on-call*). El nombre lleva
 *                         `Rotation` a propósito: un `onCall` a secas se leería como «está de guardia
 *                         ahora mismo», y esto es la pertenencia a la rueda, **no** el turno de hoy —
 *                         quién está de guardia ahora sale del calendario de Google
 *                         (`cronjobs/status-control`), no de aquí.
 *                         Ojo: estar en la rueda no es lo mismo que **cubrirla**. Banear o desactivar a
 *                         alguien no le quita el flag, igual que no le quita los roles, pero una cuenta
 *                         que no puede entrar no puede revisar el panel: quien cuente la rueda efectiva
 *                         tiene que cruzarlo con `status`, no leer este campo a secas.
 *                         **Ausente** cuando quien pregunta no tiene `status.oncall.list`. Falta en vez
 *                         de llegar a `false` a propósito: un `false` diría «no hace guardia» en lugar
 *                         de «no puedes verlo», y quien lo pintase enseñaría un dato inventado. Mismo
 *                         criterio que las identidades de `/backend/rol/list` con `status.user.list`.
 * @property registered  - Fecha de alta, en milisegundos epoch.
 * @property lastAccess  - Último acceso, en milisegundos epoch; ausente si nunca ha entrado.
 * @property lang        - Idioma preferido.
 * @property timezone    - Zona horaria preferida.
 * @property avatar      - URL del avatar, si tiene.
 * @property departments - Identificadores de departamento (`EDepartment`) a los que pertenece.
 * @property roles       - Identificadores de rol asignados. Son los roles **directos**: los
 *                         permisos que hereda por la jerarquía `role.parent` no se reflejan aquí.
 * @property groupRoles  - Identificadores de rol que le llegan **por sus grupos**, sea la pertenencia
 *                         directa o por anidamiento, ya cruzados con el rango que tiene en cada uno. Van
 *                         aparte de `roles` y no mezclados porque no se gestionan en el mismo sitio: un rol
 *                         directo se quita de la ficha del usuario y uno de grupo solo se quita sacándolo
 *                         del grupo o cambiando lo que el grupo concede.
 *
 *                         **Los dos conjuntos se solapan**: un rol puede estar en las dos listas, y
 *                         entonces quitar el directo no se lo quita a la persona — lo sigue teniendo por el
 *                         grupo. La pantalla tiene que distinguirlo, porque la casilla de un rol que solo
 *                         llega por grupo no se puede desmarcar.
 *
 *                         Llega **vacía** sin `status.group.list`, igual que `groups`: de dónde salen los
 *                         permisos de alguien es información de los grupos.
 * @property groups      - Grupos a los que pertenece, con su rango. Van **los directos y los que le llegan
 *                         por anidamiento**, distinguidos por `IUserGroup.directo` para que la pantalla los
 *                         pinte de forma distinta: son dos cosas que se gestionan en sitios distintos —el
 *                         directo se quita de la lista de miembros de ese grupo, el indirecto solo se quita
 *                         sacándolo del grupo que lo trae, o deshaciendo la arista—.
 *
 *                         Llega **vacía** sin `status.group.list`, igual que pasa con las identidades en
 *                         otros listados: saber qué grupos hay es cosa del permiso de grupos.
 * @property groupCount  - A cuántos grupos pertenece en total, directos e indirectos. **Va siempre**, con
 *                         permiso o sin él, y por eso es lo único que distingue «no pertenece a ninguno» de
 *                         «pertenece pero no puedes verlos»: con permiso, `groups.length` es esta cifra.
 */
export interface IUser {
    id: number;
    name: string;
    email: string;
    status: EUserStatus;
    onCallRotation?: boolean;
    registered: number;
    lastAccess?: number;
    lang: string;
    timezone: string;
    avatar?: string;
    departments: number[];
    roles: number[];
    groupRoles: number[];
    groups: IUserGroup[];
    groupCount: number;
}

/**
 * Grupo al que pertenece un usuario, con el rango que tiene en él.
 *
 * **Lleva el nombre dentro y no solo el id**, al contrario que `IUser.departments` y `IUser.roles`, que se
 * resuelven contra los catálogos que viajan en `IListOUT`. Aquí no hay catálogo de grupos que viaje, y no se
 * añade: esto es de solo lectura, así que un catálogo solo serviría para resolver nombres — que es
 * exactamente lo que evita traerlos ya puestos. Mismo criterio que `IRolGroup` en `rol/list`.
 *
 * **De solo lectura desde la ficha del usuario.** Meter o sacar a alguien de un grupo se hace desde la
 * pantalla del grupo, que es donde están las reglas: solo se toca a quien está por debajo, no se reparte un
 * rango por encima del propio y el grupo no puede quedarse sin propietario. Un segundo camino de escritura
 * obligaría a repetirlas, y es el mismo motivo por el que la ficha del rol tampoco deja tocar sus grupos.
 * Ojo: departamentos y roles **sí** se editan desde aquí, así que la diferencia llama la atención — la
 * diferencia es que aquellos son una simple pertenencia y esta lleva un rango con reglas propias.
 *
 * @property id      - Identificador del grupo.
 * @property name    - Nombre del grupo.
 * @property level   - Rango **efectivo**: el que tiene de verdad, contando el que le llega por grupos
 *                     anidados y quedándose con el mayor si llega por varios caminos (`gruposEfectivos()`).
 * @property directo - Si figura en la lista de miembros de ese grupo. A `false` pertenece **por
 *                     anidamiento**: está en otro grupo que es miembro de este, y por eso recibe lo que este
 *                     concede sin aparecer en él.
 *
 *                     Es la distinción que hace útil esta lista y no un adorno: sin ella, «por qué esta
 *                     persona puede esto» no tiene respuesta visible en ninguna pantalla del panel. Alguien
 *                     puede ser propietario efectivo de un grupo sin estar en su lista de miembros, y quien
 *                     mire esa lista no lo va a encontrar.
 */
export interface IUserGroup {
    id: number;
    name: string;
    level: EGroupLevel;
    directo: boolean;
}
