/**
 * Editor: Bixus
 * Fecha: Wed, 12 Aug 2026 12:26:29 GMT
 * Hash: d6a33c2f2c99bad409862fe4cc847de9
 * Versión: 2026.8.12+2-bixus
 * Anterior: 2026.8.12+1-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

import type {EUserStatus} from "../interface";

/**
 * Edición de un usuario del panel. Solo cubre lo que el panel puede cambiar: su estado y sus
 * asignaciones. El nombre, el email y el avatar los gobierna Firebase y se refrescan en cada
 * login, así que no se editan aquí.
 *
 * `departments` y `roles` se envían **completos**, no como altas/bajas: lo que llegue sustituye a
 * lo que hubiera.
 *
 * @property id          - Identificador interno del usuario (`user.id`).
 * @property status      - Estado en el que queda la cuenta (`EUserStatus`). Solo `ACTIVE` puede
 *                         entrar al panel: `PENDING` y `BANNED` quedan fuera.
 * @property departments - Departamentos (`EDepartment`) que pasa a tener.
 * @property roles       - Roles que pasa a tener.
 */
export interface ISaveIN {
    id: number;
    status: EUserStatus;
    departments: number[];
    roles: number[];
}
