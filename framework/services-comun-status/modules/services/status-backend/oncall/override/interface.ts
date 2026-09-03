/**
 * Editor: Bixus
 * Fecha: Tue, 25 Aug 2026 10:03:08 GMT
 * Hash: 0d38888f8fb9f4a6b55931251a84ab56
 * Versión: 2026.8.25+1-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

/**
 * Alta de un cambio puntual de guardia.
 *
 * Un cambio **reasigna** un tramo a otra persona; no es un trueque. El intercambio entre dos personas se
 * hace con dos cambios cruzados, y así también se puede ceder un día sin recibir otro a cambio.
 *
 * @property dateFrom - Primer día del tramo, `YYYY-MM-DD`, inclusive.
 * @property dateTo   - Último día, inclusive. Para un solo día, el mismo valor que `dateFrom`.
 * @property user     - Quién cubre el tramo. Tiene que estar en la rueda: un cambio es un reparto entre
 *                      quienes hacen guardia, no una forma de asignarla a alguien de fuera.
 */
export interface IOverrideIN {
    dateFrom: string;
    dateTo: string;
    user: number;
}

/**
 * Borrado de un cambio. Los cambios no se editan: se borran o se rectifican con otro cambio encima, y así
 * el historial de por qué un tramo acabó en quien acabó se lee de las filas.
 *
 * @property id - Identificador del cambio.
 */
export interface IOverrideDeleteIN {
    id: number;
}
