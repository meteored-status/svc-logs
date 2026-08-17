/**
 * Editor: Bixus
 * Fecha: Wed, 12 Aug 2026 09:01:06 GMT
 * Hash: a9b4c128501794f72da20a4842610fc5
 * Versión: 2026.8.12+1-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

/**
 * Borrado de un usuario del panel: el usuario y sus relaciones (roles, departamentos y
 * suscripciones).
 *
 * @property id       - Identificador interno del usuario (`user.id`), no su UID de Firebase.
 * @property firebase - Si además hay que borrar su identidad de Firebase. Por defecto `false`:
 *                      sin ella el usuario deja de existir en el panel, pero si vuelve a entrar
 *                      el login le crea una cuenta nueva deshabilitada. Con `true` el borrado es
 *                      definitivo y tendría que registrarse otra vez.
 */
export interface IDeleteIN {
    id: number;
    firebase?: boolean;
}
