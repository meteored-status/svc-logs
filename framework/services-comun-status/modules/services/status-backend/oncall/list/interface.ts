/**
 * Editor: Bixus
 * Fecha: Tue, 25 Aug 2026 10:03:08 GMT
 * Hash: a87edb06e8c03c7894f9c99460a74a04
 * Versión: 2026.8.25+1-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

import type {IOnCallCycleInfo, IOnCallHoliday, IOnCallOverride, IOnCallSkip, IOnCallUser, IOnCallWeek} from "../interface";

/**
 * Todo lo que pinta la pantalla de Guardia, en una sola petición: la rueda, a quién se puede añadir, la
 * planificación de las próximas semanas, los festivos de esa ventana y los cambios que la afectan.
 *
 * Va junto y no en cinco endpoints porque las cinco cosas se leen a la vez y ninguna se entiende sola: la
 * planificación son ids que hay que resolver contra la rueda, y un festivo o un cambio solo significan
 * algo al ver en qué semana caen.
 *
 * @property wheel      - La rueda, **en orden**. El orden es el reparto, así que el array llega ya
 *                        ordenado y no hay que reordenarlo por `order`.
 * @property candidates - Usuarios que **no** están en la rueda y se podrían añadir. Solo cuentas activas:
 *                        meter en la rueda a quien no puede entrar al panel dejaría su semana sin cubrir,
 *                        y el backend lo rechaza igual.
 * @property weeks      - Planificación, desde la semana en curso. Cuántas van las decide el backend.
 * @property holidays   - Festivos que caen dentro de la ventana de `weeks`, para poder marcarlos y ofrecer
 *                        borrar los manuales.
 * @property overrides  - Cambios puntuales que solapan la ventana.
 * @property skips      - Saltos de turno que solapan la ventana.
 * @property cycles     - Desde dónde se cuenta cada ciclo, para los que se hayan reseteado. Los que no
 *                        aparezcan se cuentan desde el origen fijo del código, que es el comportamiento por
 *                        defecto: la lista vacía significa «nunca se ha reseteado nada».
 * @property today      - Hoy en la zona de la guardia (`Europe/Madrid`), `YYYY-MM-DD`. Lo pone el backend y
 *                        no el navegador: el reloj del cliente puede estar en otra zona, y con él la semana
 *                        «en curso» que resaltase la pantalla no sería la misma que la del reparto.
 * @property currentWeekUser  - Quién cubre la **semana en curso**, o ausente si no hay nadie. Es la persona
 *                        a la que se llama un martes por la tarde.
 *
 *                        Se calcula aquí y no en el cliente a propósito: la respuesta no es
 *                        `weeks[0].user` —ese es el titular por rueda, sin descontar saltos— ni tampoco
 *                        «quien cubre hoy», que si hoy es festivo devolvería a la persona del ciclo de
 *                        festivos. Es el primer día de la semana que **no** sea festivo ni cambio puntual,
 *                        que es la rueda semanal con los saltos ya aplicados. Deducirlo en el cliente
 *                        significaría una segunda implementación del reparto, y dos implementaciones
 *                        discrepan.
 * @property nextHolidayUser - Quién cubre el **próximo festivo**, o ausente si no hay festivo o si ese día
 *                        no lo cubre nadie (toda la rueda saltada). Con saltos y cambios ya aplicados.
 * @property nextHoliday - El próximo festivo desde hoy, `YYYY-MM-DD`, o ausente si no hay ninguno.
 *
 *                        Sale del listado **completo** de festivos y no de `holidays`, que solo trae los de
 *                        la ventana: son dos cosas distintas y confundirlas tiene consecuencias. Resetear el
 *                        ciclo de festivos ancla al próximo, así que la pantalla necesita saber si existe
 *                        alguno para poder ofrecer o no la operación; buscándolo en `holidays` daría
 *                        «ninguno» tanto cuando la tabla está vacía como cuando el siguiente cae más allá de
 *                        las semanas que se pintan, y en el segundo caso el reseteo **sí** funcionaría.
 */
export interface IListOUT {
    wheel: IOnCallUser[];
    candidates: IOnCallUser[];
    weeks: IOnCallWeek[];
    holidays: IOnCallHoliday[];
    overrides: IOnCallOverride[];
    skips: IOnCallSkip[];
    cycles: IOnCallCycleInfo[];
    today: string;
    nextHoliday?: string;
    currentWeekUser?: number;
    nextHolidayUser?: number;
}
