/**
 * Editor: Bixus
 * Fecha: Tue, 01 Sep 2026 13:11:20 GMT
 * Hash: d3827e60a467b9a0e03157c95044e2f5
 * Versión: 2026.9.1+3-bixus
 * Anterior: 2026.9.1+1-bixus
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
 */
export interface ILimitDateOUT {
    effectiveDate: string;
    description: string;
    limits: Record<string, number>;
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
 */
export interface ILimitsOUT {
    dates: ILimitDateOUT[];
    metrics: {metric: string; unit: string; agg: string; apiConfirmed: boolean}[];
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
 */
export interface ILimitsSaveIN {
    effectiveDate: string;
    newEffectiveDate?: string;
    description?: string;
    limits: Record<string, number>;
}
