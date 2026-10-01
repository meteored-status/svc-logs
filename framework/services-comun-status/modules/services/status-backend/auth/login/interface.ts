/**
 * Editor: Bixus
 * Fecha: Wed, 23 Sep 2026 08:46:25 GMT
 * Hash: aae70f5e38ebd9c5caad624ebd485822
 * Versión: 2026.9.23+1-bixus
 * Anterior: 2026.9.14+5-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

import type {EGroupLevel} from "../../group/interface";
import type {EPermission} from "../interface";
import type {ERolStatus} from "../../rol/interface";

export interface ILoginIN {
    lang: string;
    timezone: string;
    name?: string;
}

/**
 * Rol asignado al usuario de la sesión.
 *
 * Son los roles **directos**, los que alguien le puso en la ficha; no los ancestros de los que estos
 * heredan. Lo que llega por herencia ya está en `permissions`, que es el conjunto que decide lo que se
 * puede hacer.
 *
 * @property id          - Identificador del rol.
 * @property name        - Nombre visible.
 * @property description - Descripción del rol, tal como la guarda el panel.
 * @property status      - Estado del rol (`ERolStatus`). Va porque un rol asignado no siempre concede:
 *                         los deshabilitados no dan nada mientras lo estén, y sin el estado la sesión
 *                         diría que se tiene un rol que en realidad no está sirviendo de nada.
 */
export interface ILoginRole {
    id: number;
    name: string;
    description: string;
    status: ERolStatus;
}

/**
 * Un departamento al que pertenece quien tiene la sesión.
 *
 * @property id   - Identificador del departamento.
 * @property name - Nombre, tal como está en la tabla `department`. Viaja resuelto porque el cliente no tiene
 *                  de dónde sacarlo: el catálogo completo va con `status.dpto.list`, que un usuario normal
 *                  no tiene, y el enum `EDepartment` solo conoce los de la semilla.
 */
export interface ILoginDepartment {
    id: number;
    name: string;
}

/**
 * Un grupo al que pertenece quien tiene la sesión.
 *
 * Tipo propio y no el `IUserGroup` de `user/list`, aunque hoy lleven los mismos campos: cada endpoint
 * declara su contrato, para que el día que a uno le haga falta algo más no se lo lleve el otro por delante.
 * Mismo criterio que `ILoginRole` con los tipos de rol de las otras pantallas.
 *
 * @property id      - Identificador del grupo.
 * @property name    - Nombre del grupo.
 * @property level   - Rango **efectivo**: el mayor si llega por varios caminos (`gruposEfectivos()`).
 * @property directo - Si figura en la lista de miembros de ese grupo. A `false` pertenece por anidamiento:
 *                     está en otro grupo que es miembro de este, y por eso recibe lo que este concede sin
 *                     aparecer en él. Es lo que explica un permiso que no venga de ningún rol de `roles`.
 */
export interface ILoginGroup {
    id: number;
    name: string;
    level: EGroupLevel;
    directo: boolean;
}

/**
 * Sesión del usuario, tal y como la devuelve el login.
 *
 * @property name        - Nombre del usuario.
 * @property email       - Email, único por usuario.
 * @property avatar      - URL del avatar del proveedor de identidad, si tiene.
 * @property lang         - El idioma preferido de la persona, tal cual está guardado.
 *
 *                          **No es el idioma que se está pintando** —eso lo manda la URL— sino la
 *                          preferencia. Viaja en el login porque lo necesitan dos cosas del cliente:
 *                          marcar la opción elegida en el selector, y saber a qué URL llevar a
 *                          alguien que entra por la raíz.
 * @property permissions - Permisos **efectivos**: la unión de los que conceden sus roles **directos y los
 *                         que le dan sus grupos**, herencia incluida y deduplicada. Lo segundo desde que un
 *                         grupo concede roles (`ddl-alter-0044.sql`), y de ahí que un permiso de aquí pueda
 *                         no tener explicación en `roles`, que solo lleva los directos: la tiene en
 *                         `groups`.
 * @property roles        - Roles asignados de forma directa, ordenados por nombre y **sin los borrados**:
 *                          un borrado lógico no concede nada y ha desaparecido del panel, así que en la
 *                          sesión solo sería ruido. Es información de a qué se debe el acceso, no lo que
 *                          lo concede — eso es `permissions`.
 * @property groups      - Grupos a los que pertenece, con el rango que tiene en cada uno, ordenados por
 *                         nombre. Van los directos y los que le llegan **por anidamiento** —estar en un
 *                         grupo que es miembro de otro—, distinguidos por `ILoginGroup.directo`.
 *
 *                         **No lo tapa ningún permiso**, al contrario que en las pantallas de
 *                         administración, donde ver los grupos de otra persona va con `status.group.list`.
 *                         Aquí son los propios: no hace falta permiso para saber dónde está uno.
 * @property departments - Departamentos a los que pertenece, **con su nombre**.
 *
 *                         Llevan el nombre y no solo el id, y ese es el arreglo de un fallo real: la ficha
 *                         los etiquetaba con `getDepartmentName()`, que resuelve contra el enum
 *                         `EDepartment` —un catálogo de compilación con los cuatro de la semilla—, así que
 *                         un departamento creado desde `/manager/dpto` salía como `#5` en vez de con su
 *                         nombre. La tabla `department` es la fuente de la verdad desde que se administran
 *                         desde el panel, y el propio `getDepartmentName()` lo avisa en su JSDoc: para
 *                         etiquetar hay que usar lo que viaje en el payload, no el enum.
 * @property services    - Ids de los servicios que puede consultar, deducidos de sus departamentos.
 * @property impersonation - Presente **solo si esta sesión es una suplantación**: los datos de arriba son de la
 *                          persona suplantada, no de quien pidió el login.
 *
 *                          Lo dice el servidor y no se deduce en el cliente, y ahí está el motivo de que exista:
 *                          el navegador sabe que **pidió** suplantar, no que se le haya concedido. Si el permiso
 *                          se revoca a media sesión, o la cuenta objetivo se desactiva, el login devuelve la
 *                          sesión de siempre — y sin este campo la pestaña seguiría anunciando «estás viendo el
 *                          panel como otra persona» encima de los datos propios, que es la peor confusión
 *                          posible en este modo. Con él, el cliente detecta que su marca no valió y la tira.
 *
 *                          Es un objeto y no un booleano porque hay **dos** modos y la pantalla tiene que
 *                          distinguirlos: mirar no es lo mismo que poder tocar.
 */
export interface ILoginOUT {
    name: string;
    email: string;
    avatar?: string;
    lang: string;
    permissions: EPermission[]
    roles: ILoginRole[];
    groups: ILoginGroup[];
    departments: ILoginDepartment[];
    services: number[];
    impersonation?: ILoginImpersonation;
}

/**
 * En qué modo se está suplantando.
 *
 * @property readonly - `true` con `status.impersonate.view`: se ve el panel de esa persona y **no se puede
 *                      escribir nada**, ni siquiera el registro de accesos. `false` con
 *                      `status.impersonate.full`: se puede operar en su nombre, y cada acción queda en la
 *                      auditoría a nombre de quien suplanta, diciendo a quién suplantaba.
 *
 *                      Viaja porque la pantalla tiene que poder decirlo con otras palabras —«viendo como» no es
 *                      «actuando como»— y porque de él depende si el cliente registra los accesos: con
 *                      `readonly` no puede, así que ni lo intenta.
 */
export interface ILoginImpersonation {
    readonly: boolean;
}
