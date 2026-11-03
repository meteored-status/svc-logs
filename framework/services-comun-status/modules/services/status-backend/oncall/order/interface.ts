/**
 * Editor: Bixus
 * Fecha: Mon, 26 Oct 2026 13:34:19 GMT
 * Hash: 11b213fa8665c7e73cf0c6ada30cb922
 * Versión: 2026.10.26+1-bixus
 * Anterior: 2026.8.25+1-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

import type {IConfirmable} from "../efectos/interface";

/**
 * Nuevo orden de la rueda.
 *
 * @property users - Ids **de toda la rueda**, en el orden final. La posición de cada uno es su índice.
 *                   Llega completa y sustituye: reordenar es reescribir todas las posiciones a la vez, y
 *                   mandar solo el que se movió dejaría a dos personas en la misma posición. El flow
 *                   rechaza la petición si la lista no es exactamente la rueda actual —ni un id de menos,
 *                   ni uno de más, ni repetidos—, porque una lista incompleta significaría sacar gente de
 *                   la rueda por la puerta de atrás, que es otra operación con su propio endpoint.
 * @property moved - Ids de **quienes la persona ha movido**: la flecha y el arrastre mueven a uno. Lo necesita la regla de
 *                   la vuelta: sobre la lista completa, «D detrás de F» y «F delante de D» son el mismo resultado y dan
 *                   colas distintas. Sin él se deduce con un desempate determinista (la subsecuencia común más larga
 *                   entre la rueda de antes y la nueva; en un intercambio de dos adyacentes, se lee que se movió el
 *                   primero). Si llega, el resto —lo que no se ha movido— tiene que quedar en el mismo orden relativo
 *                   que antes; si no, el flow rechaza la petición.
 */
export interface IOrderIN extends IConfirmable {
    users: number[];
    moved?: number[];
}
