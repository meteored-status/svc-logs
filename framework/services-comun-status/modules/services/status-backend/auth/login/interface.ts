/**
 * Editor: Bixus
 * Fecha: Wed, 02 Sep 2026 14:14:26 GMT
 * Hash: 5019121c12e4ff2f0d5c4dcc88d62e9b
 * Versión: 2026.9.2+1-bixus
 * Anterior: 2026.8.26+2-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

import {EPermission} from "../interface";
import {ERolStatus} from "../../rol/interface";

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
 * Sesión del usuario, tal y como la devuelve el login.
 *
 * @property name        - Nombre del usuario.
 * @property email       - Email, único por usuario.
 * @property avatar      - URL del avatar del proveedor de identidad, si tiene.
 * @property permissions - Permisos **efectivos**: la unión de los que conceden sus roles, herencia
 *                         incluida y deduplicada.
 * @property roles        - Roles asignados de forma directa, ordenados por nombre y **sin los borrados**:
 *                          un borrado lógico no concede nada y ha desaparecido del panel, así que en la
 *                          sesión solo sería ruido. Es información de a qué se debe el acceso, no lo que
 *                          lo concede — eso es `permissions`.
 * @property departments - Ids de los departamentos a los que pertenece.
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
    /**
     * El idioma preferido de la persona, tal cual está guardado.
     *
     * **No es el idioma que se está pintando** —eso lo manda la URL— sino la preferencia. Viaja en el login porque
     * lo necesitan dos cosas del cliente: marcar la opción elegida en el selector, y saber a qué URL llevar a
     * alguien que entra por la raíz.
     */
    lang: string;
    permissions: EPermission[]
    roles: ILoginRole[];
    departments: number[];
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
