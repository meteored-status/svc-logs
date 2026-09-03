/**
 * Editor: Bixus
 * Fecha: Tue, 01 Sep 2026 09:55:30 GMT
 * Hash: ff9ef4193a9aed799ef040c213dc9d18
 * Versión: 2026.9.1+1-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

/**
 * Hasta cuándo llega la recogida: **el consumo se guarda con dos días de retraso**.
 *
 * Los agregados diarios de Cloudflare siguen consolidándose un rato después de medianoche, y el data stream es de
 * solo adición —un día escrito a medio consolidar queda mal para siempre—, así que el cronjob no escribe ni el día
 * en curso ni el anterior. Lo que se persigue es histórico largo, y un día de frescura no vale lo que vale un dato
 * firme.
 *
 * Vive en el contrato y no en el cronjob porque lo necesitan los dos lados: el cronjob para saber hasta dónde
 * pedir, y la pantalla para anclar la ventana de «últimos 30 días» al último día que puede tener dato en vez de a
 * hoy. Con el número duplicado, el día que se cambie uno la pantalla enseñaría dos días vacíos al final de cada
 * gráfica sin que nadie relacionase una cosa con la otra.
 *
 * **No aplica al inventario**, que no es analítica: es una foto por REST de cómo está la cuenta ahora mismo, y se
 * guarda con la fecha de hoy.
 */
export const RETRASO_DIAS = 2;

/**
 * El consumo de Cloudflare para la pantalla de `/infra/cloudflare`.
 *
 * @property metric      - Clave de la serie (`cdn.data_transfer`, `access.seats`). No se renombra nunca: es lo
 *                         que une el histórico, y un cambio de nombre parte la serie en dos que nadie va a
 *                         volver a juntar.
 * @property unit        - En qué está expresado el valor (`TB`, `MM`, `MM_ms`, `MB`, `count`). Viaja con la
 *                         serie porque una serie histórica sin unidad no se puede releer con seguridad tres
 *                         renovaciones después.
 * @property agg         - `sum` en lo que se acumula y `max` en lo que es un nivel. **La pantalla tiene que
 *                         mirarlo**: el consumo mensual de un caudal es la suma del mes, y el de un nivel es su
 *                         máximo. Sumar los asientos de los 30 días de un mes da 1.080 asientos, que no
 *                         significa nada.
 * @property entitlement - Lo contratado al mes, si se sabe. Ausente cuando no.
 * @property since       - Primer día que tiene esa métrica **en todo el índice**, `YYYY-MM-DD`. Sirve para no
 *                         confundir «esto no se recogía todavía» con «esto se perdió»: una serie que nació ayer no
 *                         tiene huecos, tiene principio.
 * @property points      - La serie diaria, en orden. Un día que falte **no viene como cero**: viene ausente,
 *                         porque un cero se lee como «ese día no hubo consumo» y lo que pasa es que ese día no
 *                         se pudo medir. Las series arrancan en fechas distintas a propósito: el balanceo solo
 *                         conserva 30 días y las DNS queries 62.
 */
export interface ICloudflareMetricOUT {
    metric: string;
    unit: string;
    agg: string;
    entitlement?: number;
    since?: string;
    points: {date: string; value: number}[];
}

/**
 * Una línea del contrato que **no se está midiendo**.
 *
 * No es un hueco a rellenar sino información: dice que se contrató algo cuyo consumo no se puede saber por API,
 * y eso vale para la renovación. Hoy son `acm.domains` y `rate_limiting.requests`.
 *
 * Dos estuvieron aquí y ya no, y las dos por lo mismo: las di por no medibles sin comprobarlo.
 * `load_balancing.dns_queries` se cuenta filtrando la analítica de DNS por los nombres de los balanceadores, y
 * `cache_reserve.storage` se estima a partir de los shards muestreados —con menos del 1% de error, porque el hash
 * los reparte uniformemente—.
 *
 * Se calcula por diferencia entre el catálogo de topes y lo que hay en el índice, así que una métrica que se
 * empiece a recoger desaparece de esta lista sola.
 *
 * @property metric      - Clave de la línea.
 * @property entitlement - Lo contratado al mes.
 */
export interface ICloudflareSinMedirOUT {
    metric: string;
    entitlement: number;
}

/**
 * @property from      - Primer día del rango devuelto, `YYYY-MM-DD`.
 * @property to        - Último día, `YYYY-MM-DD`.
 * @property metrics   - Una entrada por métrica con datos en el rango.
 * @property unmeasured - Las líneas del contrato sin recolector.
 * @property absent    - Métricas que **existen en el índice pero no tienen ni un día en este periodo**. No es lo
 *                       mismo que no medirlas: es que ese periodo no las alcanza. El caso normal son los días 1 y
 *                       2 de cada mes, cuando el inventario ya tiene el día de hoy y la analítica —que se guarda
 *                       con dos días de retraso— todavía no tiene nada. Sin esta lista, la pantalla enseñaba ocho
 *                       tarjetas de veintitrés sin decir una palabra, y eso se lee como que quince métricas se
 *                       han roto.
 * @property months    - Meses que tienen alguna medida, en `YYYY-MM` y de más reciente a más antiguo. Es lo que
 *                       llena el selector de periodo con meses concretos, y viaja en cada respuesta porque el
 *                       histórico crece: la retención son tres años, así que una lista fija ofrecería meses vacíos.
 * @property zones     - Nombres de las zonas que tienen detalle guardado, para el desglose. Va aquí y no en una
 *                       llamada aparte porque es una lista de 28 cadenas que la pantalla necesita para pintar el
 *                       selector antes de pedir nada.
 */
export interface ICloudflareOUT {
    from: string;
    to: string;
    metrics: ICloudflareMetricOUT[];
    unmeasured: ICloudflareSinMedirOUT[];
    absent: string[];
    months: string[];
    zones: string[];
}
