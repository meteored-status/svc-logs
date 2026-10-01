/**
 * Editor: Bixus
 * Fecha: Fri, 11 Sep 2026 09:36:01 GMT
 * Hash: fd12c5948b090a3348101e6a7c689845
 * Versión: 2026.9.11+1-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

import type {EGroupLevel} from "../interface";

/**
 * Roles que concede un grupo.
 *
 * Endpoint aparte del de guardado, con permiso aparte (`status.group.role.edit`), porque es lo único de esta
 * feature que reparte autoridad: quien pueda tocar esto decide qué puede hacer en el panel todo el que
 * pertenezca al grupo — y todo el que pertenezca a un grupo anidado dentro de él. Ver `ISaveIN` de `../save`.
 *
 * @property id    - Identificador del grupo.
 * @property roles - Roles con el rango desde el que se conceden. La lista llega completa y **sustituye** a la
 *                   anterior; vacía deja el grupo sin conceder nada, que es una operación legítima y por eso
 *                   sí se acepta vacía —al contrario que la de miembros—.
 */
export interface IRolesIN {
    id: number;
    roles: IGroupRoleIN[];
}

/**
 * Rol a conceder.
 *
 * @property role     - Identificador del rol. Se rechaza si alguno de sus permisos efectivos está en
 *                      `PERMISOS_NO_DELEGABLES` (`rolDelegable()`) o si quien edita no tiene todo lo que el
 *                      rol concede: no se reparte desde un grupo autoridad que uno no tenga ya. Lo segundo lo
 *                      comprueba la misma regla que gobierna asignar un rol a una persona, que es el mismo
 *                      acto visto por el otro lado.
 *
 *                      **`status.admin` salta las dos**, igual que al editar un rol: es lo que permite montar
 *                      un grupo «Administradores» que conceda el rol Administrador.
 * @property minLevel - Rango mínimo que lo recibe. No tiene valor por defecto **a propósito**, ni aquí ni en
 *                      la columna: el default cómodo sería el rango más bajo, que es el que más reparte, así
 *                      que un rol al que se le olvide el rango falla en vez de concederse a todo el grupo.
 */
export interface IGroupRoleIN {
    role: number;
    minLevel: EGroupLevel;
}
