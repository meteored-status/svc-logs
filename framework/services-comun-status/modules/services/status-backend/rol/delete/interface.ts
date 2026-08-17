/**
 * Editor: Bixus
 * Fecha: Thu, 13 Aug 2026 06:54:48 GMT
 * Hash: 6b10f46bf3df50ad3afa7b38ee9e5f2c
 * Versión: 2026.8.13+1-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

/**
 * Rol a borrar. El borrado es **lógico**: deja la fila y pone `status` en `DELETED`, así que el rol
 * deja de conceder permisos pero no se pierde el histórico ni se rompen las claves ajenas de
 * `role_permission`, `user_role` y `role.parent`.
 *
 * @property id - Identificador del rol.
 */
export interface IDeleteIN {
    id: number;
}
