/**
 * Editor: Bixus
 * Fecha: Mon, 07 Sep 2026 14:26:51 GMT
 * Hash: 0ba18e5983beef913846be778d96795e
 * Versión: 2026.9.7+2-bixus
 * Anterior: 2026.9.1+3-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

/**
 * Un juego de límites y desde cuándo rige.
 *
 * @property effectiveDate - Primer día en que rigen, `YYYY-MM-DD`.
 * @property description   - Para qué es esa fecha: «renovación 2027», «corrección del tope de CPU»… Dentro de dos
 *                           años, una lista de fechas sin motivo no dice por qué cambió nada.
 * @property limits        - Los límites por métrica. Un juego **completo**, no un delta: al crear una fecha se
 *                           copian los vigentes, así que cada una se puede leer sola.
 * @property prices        - El precio de cada unidad de exceso, en **USD** y por métrica, tal como lo dice la tabla
 *                           de Excess Usage Pricing del acuerdo. Es lo que permite avisar de un exceso en dinero y
 *                           no en porcentaje: «133% de la transferencia contratada» no se decide igual que «unos
 *                           1.200 $ al mes».
 *
 *                           Solo están las líneas tarifadas. Una que falte **no vale cero**: significa que el
 *                           contrato no le pone precio al exceso —`Included`, o simplemente ausente de esa tabla— y
 *                           que pasarse hay que negociarlo. En dólares porque el acuerdo está en dólares, y
 *                           convertirlo a euros aquí sería inventarse un tipo de cambio.
 */
export interface ILimitDateOUT {
    effectiveDate: string;
    description: string;
    limits: Record<string, number>;
    prices: Record<string, number>;
}

/**
 * @property dates   - Las fechas de efecto, de la más antigua a la más reciente. El orden importa: la pantalla
 *                     enseña, al editar, cuál era el límite en la fecha **anterior**, y eso es lo que permite ver
 *                     de un vistazo qué cambia en cada renovación.
 * @property metrics - El catálogo de métricas conocidas con su unidad, su `agg` y si el API de Cloudflare puede
 *                     confirmar su límite. Viaja aquí porque la pantalla de límites no ve documentos y no tiene de
 *                     dónde sacar la unidad; y porque hace falta la lista **completa** para poder poner límite a
 *                     una métrica que todavía no lo tiene.
 *
 *                     `apiConfirmed` importa al teclear: en las cuatro líneas contables el cronjob avisa si lo
 *                     guardado y el API no coinciden, o sea que hay red. En las demás —las volumétricas, que son
 *                     las que de verdad se negocian— lo que se teclee ahí es **el único registro que existe** fuera
 *                     del acuerdo firmado, y no hay nada que lo contraste.
 *
 *                     `mirrors` dice que esa línea no tiene serie propia y se mide con la de otra métrica, y
 *                     `bound` que la serie prestada es solo una cota superior. Importa al teclear: el tope es
 *                     suyo y hay que apuntarlo igual, pero el porcentaje que se verá después sale de una serie
 *                     que es de otro.
 */
export interface ILimitsOUT {
    dates: ILimitDateOUT[];
    metrics: {metric: string; unit: string; agg: string; apiConfirmed: boolean; mirrors?: string; bound?: boolean}[];
}

/**
 * @property effectiveDate - La fecha nueva, `YYYY-MM-DD`.
 * @property description   - Para qué es. Opcional.
 */
export interface ILimitDateIN {
    effectiveDate: string;
    description?: string;
}

/**
 * @property effectiveDate    - Qué fecha de efecto se guarda, `YYYY-MM-DD`. Es la que **identifica** el juego, o sea
 *                              con la que se localiza; para cambiarla, ver `newEffectiveDate`.
 * @property newEffectiveDate - A qué fecha se mueve, si se corrige. Ausente o igual a `effectiveDate` significa que
 *                              no se mueve. Va como campo aparte y no reutilizando `effectiveDate` porque hacen dos
 *                              cosas distintas: una localiza la fila y la otra es el valor nuevo, y con un solo
 *                              campo no habría forma de decir cuál de las dos se quiere.
 * @property description      - Su descripción, si se cambia.
 * @property limits           - El juego completo de límites. Una métrica que no venga **se borra** de esa fecha: es
 *                              lo que permite quitar de en medio una línea que ya no se contrata.
 * @property prices           - El juego completo de precios de exceso, en USD. Mismo criterio que `limits`: lo que
 *                              no venga se queda **sin tarifar**, así que quien guarda manda las dos cosas enteras
 *                              o pierde lo que no mande. Ausente equivale a no tarifar ninguna.
 */
export interface ILimitsSaveIN {
    effectiveDate: string;
    newEffectiveDate?: string;
    description?: string;
    limits: Record<string, number>;
    prices?: Record<string, number>;
}
