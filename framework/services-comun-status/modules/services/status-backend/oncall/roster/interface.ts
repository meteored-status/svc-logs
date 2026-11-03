/**
 * Editor: Bixus
 * Fecha: Mon, 26 Oct 2026 13:34:19 GMT
 * Hash: 1e4658da3591cfc394d35027f8022440
 * Versión: 2026.10.26+1-bixus
 * Anterior: 2026.8.25+1-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

import type {IConfirmable, IRepartoOUT} from "../efectos/interface";
import {REPARTO_CAMBIADO} from "../efectos/interface";

/**
 * El mismo mensaje que `REPARTO_CAMBIADO`, con el nombre que tenía cuando solo la baja de la rueda lo usaba. Se
 * conserva para no romper a quien ya lo importa.
 */
export const ROSTER_CAMBIADO = REPARTO_CAMBIADO;

/**
 * Alta y baja en la rueda. Es lo mismo que tocar `on_call_rotation` desde la ficha del usuario, pero con
 * `status.oncall.edit` en vez de `status.user.edit`: administrar la guardia no debería exigir la capacidad
 * de activar, banear y borrar cuentas.
 *
 * Mover la rueda **mueve el reparto**, y con él los cambios de guardia que ya había acordados: cada uno sigue
 * al turno de la persona a la que sustituía. Como el resto de operaciones que mueven el reparto (`IConfirmable`),
 * se puede pedir en dos pasos: una vista previa (`preview`) que enseña qué pasaría y devuelve una huella, y la
 * confirmación (`confirm`) con esa huella. Lo que no rompe nada se aplica directamente.
 *
 * @property add    - Ids que entran en la rueda. Se colocan **al final**, cada uno con la siguiente
 *                    posición libre: entrar en la rueda no debería cambiar el turno de nadie.
 * @property remove - Ids que salen. Al salir no se recolocan los demás: sus posiciones se quedan con
 *                    huecos y el reparto solo depende del orden relativo, no de que los números sean
 *                    consecutivos. Reordenar explícitamente es lo que los compacta.
 */
export interface IRosterIN extends IConfirmable {
    add?: number[];
    remove?: number[];
}

/**
 * La respuesta del alta y la baja: la misma que la del resto de operaciones del reparto (`IRepartoOUT`).
 */
export type IRosterOUT = IRepartoOUT;
