export enum ESeverity {
    INFO        = 0,
    WARNING     = 1,
    ERROR       = 2,
    CRITICAL    = 3,
}

/**
 * Distribución de registros a lo largo del tiempo, para la gráfica que acompaña a un listado.
 *
 * La cuenta el servicio con un `auto_date_histogram`, no el cliente sobre lo que ha recibido: los
 * listados están paginados, así que en el navegador solo hay una página y repartirla en tramos dibujaría
 * el reparto de 50 registros como si fuera el del filtro entero.
 *
 * Vive aquí, junto a `ESeverity`, porque la comparten los dos listados de logs —errores y servicios— y
 * es un tipo de valor, no el payload de un endpoint concreto.
 *
 * @property interval - Anchura de cada tramo, tal y como la eligió Elasticsearch (`1h`, `7d`...). La
 *                      elige él y no el cliente para que caiga siempre en horas o días enteros, que es
 *                      lo que se sabe leer en un eje.
 * @property buckets  - Tramos, del más antiguo al más reciente. Van **todos**, incluidos los que no
 *                      tienen ningún registro: un hueco es información —ahí no pasó nada— y saltárselo
 *                      dibujaría una gráfica que miente sobre el reparto en el tiempo.
 */
export interface IHistogram {
    interval: string;
    buckets: IBucket[];
}

/**
 * Tramo de la distribución.
 *
 * @property timestamp - Instante en que empieza el tramo, en milisegundos.
 * @property count     - Registros que caen dentro del tramo.
 */
export interface IBucket {
    timestamp: number;
    count: number;
}

/**
 * Techo de registros por página de los listados de logs.
 *
 * Está para que una petición no se lleve el índice entero de una vez; pedir más no falla, se recorta a
 * este valor. **No** cambia el tamaño por defecto, que sigue siendo el de siempre (15) para no alterar
 * lo que reciben los clientes que no piden `perPage`.
 */
export const PER_PAGE_MAX = 200;

/**
 * Tope de la ventana de resultados de Elasticsearch (`index.max_result_window`).
 *
 * Los listados paginan con `from`/`size`, así que `from + size` no puede pasar de aquí: por muchos
 * registros que cumplan el filtro, más allá del número 10.000 no se llega pasando páginas y hay que
 * acotar más (por fecha, servicio o proyecto). De ahí el `reachable` de las respuestas.
 */
export const MAX_RESULT_WINDOW = 10000;
