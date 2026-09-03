/**
 * Editor: Bixus
 * Fecha: Tue, 01 Sep 2026 09:55:30 GMT
 * Hash: ac1940a740dd56c631341e4e81144055
 * Versión: 2026.9.1+1-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

/**
 * Un tope y desde cuándo rige, para poder pintar la línea del contrato en un rango que abarque varias
 * renovaciones.
 *
 * @property effectiveDate - Primer día en que rige, `YYYY-MM-DD`.
 * @property value         - El tope al mes.
 */
export interface ISerieLimitOUT {
    effectiveDate: string;
    value: number;
}

/**
 * Una sola métrica sobre un rango cualquiera, para el detalle.
 *
 * Va en su propio endpoint y no en el del panel porque las dos preguntas son distintas: el panel pide **todas** las
 * métricas de un periodo corto, y el detalle **una** métrica de un periodo que puede ser de años. Pedirlo por el
 * del panel traería veintiuna series de tres años, que además se pasaría del techo de documentos de la consulta.
 *
 * @property metric      - Clave de la serie.
 * @property unit        - Unidad.
 * @property agg         - `sum` o `max`. Decide cómo se agrupa por mes, así que la pantalla **tiene** que mirarlo.
 * @property since       - Primer día que tiene la métrica en todo el índice.
 * @property points      - La serie diaria, en orden. Los días sin medida vienen **ausentes**, no a cero.
 * @property limits      - Los topes de esa métrica con su fecha de efecto, ordenados. Ausente si no tiene ninguno.
 *
 *                         Viajan **todos** y no solo el vigente porque un rango largo puede abarcar varias
 *                         renovaciones, y una única línea de tope sobre tres años de gráfica sería falsa en la
 *                         mayor parte de ella. Quien pinta resuelve el tope de cada punto por su fecha.
 */
export interface ISerieOUT {
    metric: string;
    unit: string;
    agg: string;
    since?: string;
    points: {date: string; value: number}[];
    limits: ISerieLimitOUT[];
}
