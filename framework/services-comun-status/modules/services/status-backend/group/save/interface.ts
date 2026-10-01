/**
 * Editor: Bixus
 * Fecha: Fri, 11 Sep 2026 09:36:01 GMT
 * Hash: 5ea9f8a08bf0143c15111aea41394714
 * Versión: 2026.9.11+1-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

import type {EGroupLevel} from "../interface";

/**
 * Cambios a guardar en un grupo, o los datos de uno nuevo.
 *
 * **Los roles que concede el grupo no están aquí**: se guardan por `/backend/group/roles`, que
 * es otro endpoint con otro permiso. No es una separación cosmética — es lo único de los grupos que puede
 * fabricar autoridad, y en este repo el permiso se declara en la tabla de rutas para que se lea de un
 * vistazo qué protege cada endpoint. Un `/save` que aceptara también los roles obligaría a
 * comprobarlos dentro del handler, y la tabla de rutas mentiría.
 *
 * @property id          - Identificador del grupo a modificar. **Ausente da de alta uno nuevo**, y MySQL
 *                         le asigna el id. Mismo criterio que `ISaveIN` de rol y de departamento.
 * @property name        - Nombre visible. Es **único** en la tabla, así que un nombre repetido se
 *                         rechaza.
 * @property description - Para qué es el grupo. **Puede ir vacía**: es un texto de ayuda, no un
 *                         identificador, y el nombre ya distingue el grupo. Mismo criterio que `rol` y
 *                         `dpto`, que tampoco la exigen.
 * @property members     - Miembros con su rango. La lista llega completa y **sustituye** a la anterior.
 *                         Omitirla deja las pertenencias como están, que es lo que hay que hacer si no se
 *                         quieren tocar: mandarla vacía saca a todo el mundo —y por tanto se rechaza, que
 *                         dejaría el grupo sin propietario—.
 *
 *                         En un alta, omitirla mete como **propietario** a quien crea el grupo: un grupo
 *                         sin propietario no lo puede administrar nadie, así que no se deja crear.
 * @property groups      - Grupos que son miembros de este, con su rango. La lista llega completa y
 *                         **sustituye**; omitirla deja el anidamiento como está. A diferencia de `members`,
 *                         mandarla vacía **sí** es legítimo: quitar todos los grupos miembros no deja el
 *                         grupo huérfano mientras le queden personas propietarias.
 */
export interface ISaveIN {
    id?: number;
    name: string;
    description: string;
    members?: IGroupMemberIN[];
    groups?: IGroupNestedIN[];
}

/**
 * Un grupo que entra como miembro de este.
 *
 * **Tocar esto exige la vía global (`status.group.edit`); la delegada no llega.** Meter un grupo como
 * miembro entrega su administración a los administradores *de ese* grupo —cualquiera a quien ellos añadan
 * recibirá el rango de la arista aquí—, así que es una decisión sobre el grafo de autoridad del panel y no
 * gestión de miembros del día a día. Se puede relajar después añadiendo un segundo juego de permisos en la
 * tabla de rutas; hoy no está y es a propósito.
 *
 * @property group - Identificador del grupo que entra. Se rechaza si cerraría un ciclo (`haceCiclo()`) o si
 *                   es el grupo mismo — eso último lo corta también el `CHECK` del esquema.
 * @property level - Rango con el que entra, y por tanto el que reciben todos sus miembros.
 */
export interface IGroupNestedIN {
    group: number;
    level: EGroupLevel;
}

/**
 * Pertenencia a guardar.
 *
 * Va el par completo y no solo el id del usuario —al contrario que `ISaveIN.users` de departamento—
 * porque el rango es parte de la pertenencia: con dos listas separadas, una de miembros y otra de rangos,
 * se podría guardar un miembro sin rango o un rango sin miembro.
 *
 * @property user  - Identificador interno del usuario.
 * @property level - Rango dentro del grupo. Se valida con `isGroupLevel()`: un número que no sea uno de
 *                   los tres se rechaza en vez de guardarse.
 */
export interface IGroupMemberIN {
    user: number;
    level: EGroupLevel;
}
