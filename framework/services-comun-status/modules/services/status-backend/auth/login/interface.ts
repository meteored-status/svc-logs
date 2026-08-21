/**
 * Editor: Bixus
 * Fecha: Fri, 21 Aug 2026 06:11:54 GMT
 * Hash: 0f087e5b9c661de83162c9ec3905fe46
 * Versión: 2026.8.21+1-bixus
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
 */
export interface ILoginOUT {
    name: string;
    email: string;
    avatar?: string;
    permissions: EPermission[]
    roles: ILoginRole[];
    departments: number[];
    services: number[];
}
