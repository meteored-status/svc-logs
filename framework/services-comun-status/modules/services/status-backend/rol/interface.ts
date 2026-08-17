/**
 * Editor: Bixus
 * Fecha: Thu, 13 Aug 2026 06:54:48 GMT
 * Hash: e36ea712265ac87f0465b26c34c14fad
 * Versión: 2026.8.13+1-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

/**
 * Estado de un rol del panel. Son excluyentes: la columna `role.status` guarda uno de estos cuatro
 * valores.
 *
 * - `DISABLED`   — apagado temporal: sigue existiendo y conservando sus permisos y asignaciones,
 *                  pero **no concede nada** mientras esté así.
 * - `ENABLED`    — normal, el estado de trabajo.
 * - `DEPRECATED` — en desuso: **sigue concediendo permisos**, solo avisa de que no debería
 *                  asignarse a nadie nuevo. Es la diferencia con `DISABLED`.
 * - `DELETED`    — borrado lógico: no concede nada y desaparece del listado salvo que se pida
 *                  expresamente. No se borra la fila para no perder el histórico ni romper las
 *                  claves ajenas de `role_permission`, `user_role` y `role.parent`.
 */
export enum ERolStatus {
    DISABLED   = 0,
    ENABLED    = 1,
    DEPRECATED = 2,
    DELETED    = 3,
}

const RolStatusNames: Map<ERolStatus, string> = new Map<ERolStatus, string>([
    [ERolStatus.DISABLED, 'Deshabilitado'],
    [ERolStatus.ENABLED, 'Habilitado'],
    [ERolStatus.DEPRECATED, 'Obsoleto'],
    [ERolStatus.DELETED, 'Borrado'],
]);

export function getRolStatusName(status: ERolStatus): string {
    return RolStatusNames.get(status) || '';
}

/**
 * Comprueba que un valor llegado de fuera (body de una petición, fila de base de datos) es uno de
 * los estados conocidos, para no guardar un número cualquiera en `role.status`.
 */
export function isRolStatus(status: unknown): status is ERolStatus {
    return RolStatusNames.has(status as ERolStatus);
}

/**
 * Estados en los que un rol concede sus permisos. Lo consume `Role.permissions()`, que es el único
 * camino por el que `Auth().checkPermissions()` resuelve lo que puede hacer un usuario.
 */
export const ROL_STATUS_CONCEDE: ERolStatus[] = [ERolStatus.ENABLED, ERolStatus.DEPRECATED];

/**
 * Si un rol en este estado concede sus permisos.
 */
export function rolConcede(status: ERolStatus): boolean {
    return ROL_STATUS_CONCEDE.includes(status);
}
