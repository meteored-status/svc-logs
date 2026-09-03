/**
 * Editor: Bixus
 * Fecha: Wed, 26 Aug 2026 10:32:05 GMT
 * Hash: 981d63f444ec0b056ee6846f85b980bb
 * Versión: 2026.8.26+3-bixus
 * Anterior: 2026.8.25+1-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

/**
 * Alta de un salto de turno: un tramo en el que a alguien no se le adjudican guardias.
 *
 * El turno saltado **no se recupera**. La rotación sigue contando igual, así que quien se salta una semana
 * hace una guardia menos y no se le debe nada — no hay deuda que llevar ni turno extra más adelante.
 *
 * @property dateFrom - Primer día del tramo, `YYYY-MM-DD`, inclusive.
 * @property dateTo   - Último día, inclusive. Para un solo día, el mismo valor que `dateFrom`.
 * @property user     - Quién se salta los turnos. Tiene que estar en la rueda: saltarle el turno a quien no
 *                      hace guardia no significa nada.
 * @property reason   - Por qué. **Obligatorio**: un salto le quita turnos a alguien y se lo pone a otro, así
 *                      que dentro de tres meses alguien va a preguntar, y «vacaciones» o «baja» es la
 *                      diferencia entre un dato y un misterio. No se valida contra ninguna lista — los
 *                      motivos reales no caben en un enum, y uno mal elegido acabaría con todo el mundo
 *                      poniendo «otro».
 * @property coveredBy - Quién cubre los **días sueltos** del tramo, o ausente para que no los cubra nadie.
 *
 *                      Hace falta porque la guardia semanal redondea a semanas completas: un salto que empieza
 *                      un miércoles se lleva esa semana entera. Con alguien designado, esos días de los extremos
 *                      —los que no forman semana completa— se escriben como **cambios puntuales** a su nombre y
 *                      el salto se queda solo con las semanas completas, así que la semana sigue siendo del
 *                      titular y **no se mueve ninguna guardia posterior** más de lo que mueva la ausencia real.
 *
 *                      Quien cubre lo hace **de regalo**: un cambio puntual no toca los contadores, así que no
 *                      gana ni pierde turnos propios y no se le debe nada.
 *
 *                      Cuando el tramo entero cabe en una semana —empieza y acaba dentro de ella— no hay semanas
 *                      completas que saltar: con cobertura **no se crea salto ninguno**, solo el cambio de esos
 *                      días, que es justo la diferencia entre «me salto el turno» y «que me cubran esos días».
 *
 *                      Si el tramo empieza en lunes y acaba en domingo no hay días sueltos y este campo no hace
 *                      nada: ahí no hay nada que decidir.
 */
export interface ISkipIN {
    dateFrom: string;
    dateTo: string;
    user: number;
    reason: string;
    coveredBy?: number;
}

/**
 * Borrado de un salto. Los saltos no se editan: se borran y se pone otro, así el motivo que se lee es el
 * que se escribió y no el que quedó tras varias correcciones.
 *
 * @property id - Identificador del salto.
 */
export interface ISkipDeleteIN {
    id: number;
}
