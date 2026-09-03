/**
 * Editor: Bixus
 * Fecha: Tue, 01 Sep 2026 11:32:26 GMT
 * Hash: 48a594a73d302e4de5a131152adc5d4b
 * Versión: 2026.9.1+2-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

/**
 * Qué se ha detectado.
 *
 * - `exceso`         — un hecho consumado: un mes **cerrado y completo** que se pasó del tope, o un nivel que hoy
 *                      está por encima del contratado. No es una previsión, ya pasó.
 * - `proyeccion`     — el mes en curso va camino de pasarse al ritmo que lleva. Solo en caudales: un nivel no se
 *                      proyecta, porque el máximo de asientos que ha habido no crece porque queden días.
 * - `aviso`          — se pasó del 85% sin llegar al tope. Es donde una subida deja de tener margen hasta la
 *                      renovación, así que interesa antes de que sea un exceso.
 * - `escalon`        — la serie cambió de nivel y **se quedó** en el nuevo. El hallazgo más informativo de todos:
 *                      dice que algo cambió de verdad, y cuándo.
 * - `pico`           — un día suelto muy fuera de su vecindad.
 * - `fuera-contrato` — hay consumo y el tope apuntado es 0, o sea que todo lo que se gasta va fuera del acuerdo.
 * - `sin-tope`       — se está midiendo algo que no tiene tope apuntado. Es el espejo de `unmeasured` en la
 *                      pantalla de consumo, y como aquello es informativo y no un error: puede que la línea no se
 *                      haya negociado nunca, y puede que falte teclearla en la pantalla de límites.
 * - `hueco`          — a la serie le faltan días **por dentro**. Ni lo anterior al primer dato ni lo que la
 *                      recogida aún no ha traído cuentan como hueco.
 * - `parada`         — la métrica dejó de llegar.
 */
export const enum EHallazgo {
    EXCESO         = "exceso",
    PROYECCION     = "proyeccion",
    AVISO          = "aviso",
    ESCALON        = "escalon",
    PICO           = "pico",
    FUERA_CONTRATO = "fuera-contrato",
    SIN_TOPE       = "sin-tope",
    HUECO          = "hueco",
    PARADA         = "parada",
}

/**
 * Cuánto corre.
 *
 * - `alta`  — pasarse del tope contratado, o quedarse sin dato. Cuesta dinero o ciega la pantalla.
 * - `media` — algo cambió o va camino de costar dinero: proyecciones por encima del tope, escalones, picos.
 * - `baja`  — hay que saberlo y no hay que hacer nada hoy: avisos del 85%, huecos, líneas sin tope apuntado.
 *
 * Son tres y no cinco a propósito. Una escala más fina obliga a decidir entre dos niveles que nadie va a leer
 * distinto, y lo que se persigue es que el número de la portada signifique algo.
 */
export const enum ESeveridad {
    ALTA  = "alta",
    MEDIA = "media",
    BAJA  = "baja",
}

/**
 * Una cosa detectada en una métrica.
 *
 * **Viajan números, no frases.** El texto lo escribe la pantalla, que es la que tiene las etiquetas de las métricas
 * y el formateo por unidad —un `0,25` es «0,25 TB» y un `27` es «27», sin unidad—. Mandar la frase hecha desde el
 * backend obligaría a duplicar ahí ese formateo, y a cambiar el backend para corregir una coma.
 *
 * @property kind        - Qué se detectó.
 * @property severity    - Cuánto corre.
 * @property metric      - Sobre qué métrica.
 * @property unit        - Su unidad, para que la pantalla pueda formatear sin cruzar con otra respuesta.
 * @property date        - El día al que se refiere: el del pico, el del cambio de nivel, el último medido en los
 *                         hallazgos que hablan del presente. Es también con lo que se ordena.
 * @property month       - `YYYY-MM` en los hallazgos que son de un mes (`exceso`, `proyeccion`, `aviso`).
 * @property value       - Lo medido: el consumo del mes, el valor del día, el nivel de hoy.
 * @property reference   - Contra qué se compara: el tope contratado, la vecindad del pico, el nivel anterior a un
 *                         escalón. Qué es exactamente depende de `kind`, y esa es la razón de que el nombre sea
 *                         genérico: un campo por concepto daría nueve campos opcionales de los que ocho siempre
 *                         estarían vacíos.
 * @property percent     - El porcentaje que corresponda: del tope en `exceso`/`aviso`, el proyectado en
 *                         `proyeccion`, la variación en `escalon`/`pico`. Va calculado y no derivado en la pantalla
 *                         porque el criterio de con qué se divide es del hallazgo, no de quien lo pinta.
 * @property days        - Cuántos días: los que faltan en un `hueco`, los que lleva parada una serie, los medidos
 *                         del mes en una `proyeccion`.
 * @property provisional - En un `pico` de los últimos días: **todavía no se sabe si es un pico o el principio de un
 *                         escalón**, porque no hay días posteriores con los que compararlo. Se dice en vez de
 *                         esperar una semana, que es justo lo que haría llegar tarde a lo único que da tiempo a
 *                         arreglar.
 */
export interface IHallazgoOUT {
    kind: EHallazgo;
    severity: ESeveridad;
    metric: string;
    unit: string;
    date: string;
    month?: string;
    value?: number;
    reference?: number;
    percent?: number;
    days?: number;
    provisional?: boolean;
}

/**
 * Lo detectado en el consumo de Cloudflare.
 *
 * **No lleva tendencia, y no es un olvido.** Una tendencia sobre este histórico sería falsa: el consumo de la cuenta
 * es marcadamente estacional —enero es el pico, 377 TB contra 350 contratados, y agosto el valle— así que ajustar
 * una recta a tres meses de verano y proyectarla da una previsión que dice lo contrario de lo que va a pasar. Y no
 * hay forma de arreglarlo con más código: hace falta más histórico, que es exactamente lo que este índice está
 * acumulando. De ahí que viaje `months`: cuando haya doce meses la tendencia se podrá calcular, y hasta entonces la
 * pantalla dice cuánto falta en vez de pintar una recta inventada.
 *
 * @property from     - Primer día de la ventana analizada, `YYYY-MM-DD`.
 * @property to       - Último día.
 * @property findings - Lo encontrado, ya ordenado: primero por severidad y luego por fecha, de lo más reciente a lo
 *                      más antiguo. Ordenar aquí y no en la pantalla es a propósito — el criterio es del análisis, y
 *                      la portada enseña «los tres primeros» sin tener que saber cuál es el criterio.
 * @property months   - Meses naturales **completos** que hay en el índice, contando solo los que tienen todos sus
 *                      días. Es lo que dice si se puede hablar de tendencia.
 * @property trend    - Si hay histórico suficiente para una tendencia con la estacionalidad descontada. Viaja
 *                      resuelto y no como un umbral que la pantalla tenga que comparar, para que el día que se
 *                      cambie el criterio no haya que cambiarlo en dos sitios.
 */
export interface IAnalisisOUT {
    from: string;
    to: string;
    findings: IHallazgoOUT[];
    months: number;
    trend: boolean;
}
