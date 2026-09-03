/**
 * Editor: Bixus
 * Fecha: Mon, 24 Aug 2026 11:07:07 GMT
 * Hash: 20bb7dfc85ea1881bc695ebe30abfb25
 * Versión: 2026.8.24+1-bixus
 * Anterior: 2026.8.12+2-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

import type {EUserStatus} from "../interface";

/**
 * Edición de un usuario del panel. Solo cubre lo que el panel puede cambiar: su estado y sus
 * asignaciones. El nombre, el email y el avatar los gobierna Firebase y se refrescan en cada
 * login, así que no se editan aquí.
 *
 * `departments` y `roles` se envían **completos**, no como altas/bajas: lo que llegue sustituye a
 * lo que hubiera. `onCallRotation` es la excepción: es opcional, y omitirlo **no** la borra.
 *
 * @property id          - Identificador interno del usuario (`user.id`).
 * @property status      - Estado en el que queda la cuenta (`EUserStatus`). Solo `ACTIVE` puede
 *                         entrar al panel: `PENDING` y `BANNED` quedan fuera.
 * @property onCallRotation - Si el usuario queda dentro de la rueda de la guardia (*on-call*).
 *                         **Opcional, y ausente no toca nada**: es lo que permite exigirle un permiso
 *                         propio (`status.oncall.edit`) dentro de un guardado compartido — el endpoint
 *                         responde 403 solo si el campo **viene**, así que quien no lo tenga puede
 *                         seguir guardando el estado, los roles y los departamentos con normalidad.
 *                         No mandarlo «por si acaso»: mandarlo sin el permiso corta el guardado
 *                         entero.
 * @property departments - Departamentos (`EDepartment`) que pasa a tener.
 * @property roles       - Roles que pasa a tener.
 */
export interface ISaveIN {
    id: number;
    status: EUserStatus;
    onCallRotation?: boolean;
    departments: number[];
    roles: number[];
}
