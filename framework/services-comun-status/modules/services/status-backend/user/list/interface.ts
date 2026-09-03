/**
 * Editor: Bixus
 * Fecha: Mon, 24 Aug 2026 11:07:07 GMT
 * Hash: f37c89c28bd772b9e2fc8404b42974b1
 * Versión: 2026.8.24+1-bixus
 * Anterior: 2026.8.13+2-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

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
}
