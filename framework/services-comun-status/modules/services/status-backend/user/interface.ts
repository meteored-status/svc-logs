/**
 * Editor: Bixus
 * Fecha: Mon, 24 Aug 2026 11:07:07 GMT
 * Hash: 0ff88fa2acb6dd5586273f7f9329ebae
 * Versión: 2026.8.24+1-bixus
 * Anterior: 2026.8.12+2-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

/**
 * Estado de la cuenta de un usuario del panel. Son excluyentes: la columna `user.status` guarda
 * uno de estos tres valores, y solo `ACTIVE` deja entrar.
 *
 * - `PENDING` — recién registrado por el login, a la espera de que un administrador lo active.
 * - `ACTIVE`  — activo; es el único estado con acceso al panel.
 * - `BANNED`  — vetado a mano. Conserva roles, departamentos y la guardia —para poder devolverlo a
 *               `ACTIVE` sin rehacerlos—, pero no puede entrar, así que ninguno de los tres tiene
 *               efecto mientras lo esté: en particular no cubre turnos de guardia.
 *
 * Los valores 0 y 1 son los que ya tenía la antigua columna `enabled`, así que la migración
 * (`mapping/mysql/ddl-alter-0006.sql`) es un simple cambio de nombre y tipo.
 */
export enum EUserStatus {
    PENDING = 0,
    ACTIVE  = 1,
    BANNED  = 2,
}

const UserStatusNames: Map<EUserStatus, string> = new Map<EUserStatus, string>([
    [EUserStatus.PENDING, 'Pendiente'],
    [EUserStatus.ACTIVE, 'Activo'],
    [EUserStatus.BANNED, 'Baneado'],
]);

export function getUserStatusName(status: EUserStatus): string {
    return UserStatusNames.get(status) || '';
}

/**
 * Comprueba que un valor llegado de fuera (body de una petición, fila de base de datos) es uno de
 * los estados conocidos, para no guardar un número cualquiera en `user.status`.
 */
export function isUserStatus(status: unknown): status is EUserStatus {
    return UserStatusNames.has(status as EUserStatus);
}
