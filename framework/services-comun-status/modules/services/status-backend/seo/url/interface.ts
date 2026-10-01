/**
 * Editor: Bixus
 * Fecha: Fri, 18 Sep 2026 09:12:41 GMT
 * Hash: b3198acf50eaf013d4b844dc0ad9d4eb
 * Versión: 2026.9.18+1-bixus
 * Anterior: 2026.9.17+3-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

/**
 * Cómo se agrupa el listado: por página o por URL completa.
 *
 * - `path` — la ruta sin query string, o sea **la página**. Es lo que se quiere casi siempre: las visitas de
 *            `/tiempo/madrid` juntas, vengan del buscador, de una campaña o de un enlace con `utm_source`.
 * - `uri`  — la ruta con su query string. Sirve para lo contrario: ver de qué variantes viene el tráfico de una
 *            página, que es la pregunta de quien mira una campaña.
 *
 * Las dos columnas existen en el agregado y `path` está determinado por `uri`, así que ofrecer las dos no cuesta
 * ni una fila más en la tabla — solo un `GROUP BY` distinto.
 */
export const enum EAgrupacion {
    PATH = "path",
    URI  = "uri",
}

/**
 * De qué tabla de BigQuery sale el listado: visitas humanas o rastreo de Googlebot.
 *
 * - `VISITAS` — `logs.accesos_uri`. Solo estados `200`/`304` y solo el proyecto `tiempo`: visitas útiles.
 * - `CRAWLER` — `logs.accesos_crawler_resumen`. Cualquier estado —404 y 410 incluidos— y todos los proyectos:
 *               rastreo total, no visitas. **No es la misma magnitud que `VISITAS`**: una cuenta tráfico
 *               humano y la otra peticiones de Googlebot, y una sirve para tráfico y la otra para SEO técnico
 *               (qué URLs muertas sigue pidiendo Google). Ver `mapping/bigquery/accesos_crawler_resumen.sql`.
 */
export const enum EFuente {
    VISITAS = "visitas",
    CRAWLER = "crawler",
}

/**
 * El listado de proyectos **no está aquí**: vive en `seo/projects/interface.ts` y sale de MySQL.
 *
 * Estuvo aquí, sacado del propio agregado con un `GROUP BY proyecto, subproyecto`, y costaba 154 MiB de BigQuery
 * en cada carga de la pantalla solo para llenar un desplegable — además de dar una lista que no se puede ordenar
 * ni renombrar, porque no la decide nadie: la dicta lo que hubiera en los logs de los últimos días.
 */

/**
 * Un día de la serie.
 *
 * @property date    - Día, `YYYY-MM-DD`.
 * @property visitas - Visitas de ese día.
 * @property urls    - Cuántas URLs distintas se visitaron. Es la otra mitad de la historia: mil visitas
 *                     repartidas entre diez páginas y entre mil no son el mismo día.
 */
export interface ISeoDiaOUT {
    date: string;
    visitas: number;
    urls: number;
}

/**
 * Una fila del listado.
 *
 * @property subproyecto - De qué subproyecto es la fila. **Solo viene cuando se han pedido todos los del
 *                         proyecto a la vez** (`sub` ausente), que es cuando hace falta para saber de quién
 *                         habla cada fila; pedido un subproyecto concreto sería la misma respuesta repetida en
 *                         cada línea. La cadena **vacía** significa «no tiene», que es un caso real: un proyecto
 *                         subdividido puede tener tráfico sin etiquetar.
 * @property url         - La página o la URL completa, según la agrupación pedida.
 * @property visitas     - Visitas en todo el periodo.
 * @property dias        - En cuántos días del periodo se visitó. Distingue una página con tráfico sostenido de
 *                         una que tuvo un solo día bueno, que con solo el total se leen igual.
 */
export interface ISeoUrlFilaOUT {
    subproyecto?: string;
    url: string;
    visitas: number;
    dias: number;
}

/**
 * Lo que costaría una descarga, preguntado **sin ejecutarla**.
 *
 * Sale de un `dryRun` de BigQuery, que dice cuántos bytes leería y no cobra por decirlo. Es lo que permite
 * preguntar antes de gastar en una tabla de 37 GiB y 300 millones de filas.
 *
 * **Vienen los dos números y no solo el importe**, a propósito: `bytes` es lo que dice BigQuery y es exacto,
 * mientras que `dolares` es una multiplicación por un precio de lista escrito a mano en el backend —que depende
 * de la región y no descuenta el tebibyte gratis al mes—. Si ese precio se queda viejo, el número de al lado
 * sigue siendo bueno.
 *
 * **El tope de filas no cambia ninguno de los dos.** Medido con tres dry runs sobre `tiempo/es` a 30 días: sin
 * tope, con `LIMIT 50000` y con `LIMIT 100` dan los mismos 1.040.078.278 bytes — hay que leer y agrupar la
 * columna entera para saber cuáles son las más visitadas. O sea que llevarse el listado completo **cuesta lo
 * mismo** que llevarse las más visitadas: lo que cambia es el tamaño del fichero.
 *
 * @property bytes   - Cuántos bytes leería la consulta.
 * @property dolares - Lo que costaría a precio de lista.
 */
export interface ISeoUrlCosteOUT {
    bytes: number;
    dolares: number;
}

/**
 * El detalle de un proyecto en un periodo: la evolución y qué se visita.
 *
 * Las dos cosas en una llamada porque la pantalla enseña la línea y la tabla del mismo proyecto, el mismo rango
 * y la misma agrupación: separarlas serían dos viajes y la posibilidad de que una llegue de un rango y la otra
 * de otro.
 *
 * @property days    - La serie diaria, del día más antiguo al más reciente. Los días **sin datos no aparecen**:
 *                     un hueco es un hueco, y rellenarlo con ceros diría que ese día no hubo visitas.
 * @property top     - El listado, de más visitado a menos. Recortado a lo que se pidió. **Con todos los
 *                     subproyectos a la vez la unidad es el par (subproyecto, URL)**, no la URL: el
 *                     `/tiempo/madrid` de `es` y el de `mx` son dos filas, porque juntarlos sumaría el tráfico
 *                     de dos sitios distintos bajo una sola línea que no se puede atribuir a ninguno.
 * @property visitas - Visitas de todo el periodo. No es la suma de `top`, que va recortado.
 * @property urls    - URLs distintas de todo el periodo, en la agrupación pedida. Tampoco es el tamaño de `top`.
 *                     Con todos los subproyectos cuenta pares (subproyecto, URL), en coherencia con `top`.
 */
export interface ISeoUrlDetalleOUT {
    days: ISeoDiaOUT[];
    top: ISeoUrlFilaOUT[];
    visitas: number;
    urls: number;
}
