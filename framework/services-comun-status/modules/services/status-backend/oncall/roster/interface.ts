/**
 * Editor: Bixus
 * Fecha: Tue, 25 Aug 2026 10:03:08 GMT
 * Hash: 176abaac10d0d28cf9c2e93125967220
 * Versión: 2026.8.25+1-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

/**
 * Alta y baja en la rueda. Es lo mismo que tocar `on_call_rotation` desde la ficha del usuario, pero con
 * `status.oncall.edit` en vez de `status.user.edit`: administrar la guardia no debería exigir la capacidad
 * de activar, banear y borrar cuentas.
 *
 * @property add    - Ids que entran en la rueda. Se colocan **al final**, cada uno con la siguiente
 *                    posición libre: entrar en la rueda no debería cambiar el turno de nadie.
 * @property remove - Ids que salen. Al salir no se recolocan los demás: sus posiciones se quedan con
 *                    huecos y el reparto solo depende del orden relativo, no de que los números sean
 *                    consecutivos. Reordenar explícitamente es lo que los compacta.
 */
export interface IRosterIN {
    add?: number[];
    remove?: number[];
}
