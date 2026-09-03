/**
 * Editor: Bixus
 * Fecha: Tue, 25 Aug 2026 10:03:08 GMT
 * Hash: accd46666d4abdb7a854e07457094f42
 * Versión: 2026.8.25+1-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

/**
 * Nuevo orden de la rueda.
 *
 * @property users - Ids **de toda la rueda**, en el orden final. La posición de cada uno es su índice.
 *                   Llega completa y sustituye: reordenar es reescribir todas las posiciones a la vez, y
 *                   mandar solo el que se movió dejaría a dos personas en la misma posición. El flow
 *                   rechaza la petición si la lista no es exactamente la rueda actual —ni un id de menos,
 *                   ni uno de más, ni repetidos—, porque una lista incompleta significaría sacar gente de
 *                   la rueda por la puerta de atrás, que es otra operación con su propio endpoint.
 */
export interface IOrderIN {
    users: number[];
}
