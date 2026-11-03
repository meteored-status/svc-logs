/**
 * Editor: Bixus
 * Fecha: Mon, 26 Oct 2026 13:34:19 GMT
 * Hash: 098dae3b091991be2b871b26bf769008
 * Versión: 2026.10.26+1-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

import type {EOnCallCycle} from "../interface";

/**
 * El mensaje con el que el backend rechaza una confirmación cuya huella ya no coincide, porque el reparto ha
 * cambiado desde la vista previa. Es una constante compartida y no un literal en cada lado porque la pantalla
 * **reconoce** este rechazo —y vuelve a pedir la vista previa en vez de dar el fallo por bueno— comparando el
 * texto que llega.
 */
export const REPARTO_CAMBIADO = "El reparto ha cambiado desde la vista previa: revísalo de nuevo";

/**
 * Lo que comparten las seis operaciones que mueven el reparto —alta, baja, reordenar, resetear, crear un salto y
 * borrarlo—: todas pueden pedirse en **dos pasos**, una vista previa que enseña qué pasaría y la confirmación con
 * la huella de lo que se vio.
 *
 * Las que no rompen nada se aplican directamente. Si los efectos traen algo que se mueve, se anula o se toca
 * (cambios movidos, anulados, turnos dados por hechos, saltos, solicitudes, exenciones, dispensas o días sin
 * cubrir), sin `confirm` se rechaza; con `confirm`, la huella se comprueba **siempre** contra la recalculada.
 *
 * @property preview - `true` calcula lo que pasaría **sin escribir nada** y lo devuelve. No se audita.
 * @property confirm - La huella (`IRepartoOUT.fingerprint`) de la vista previa que se confirma.
 */
export interface IConfirmable {
    preview?: boolean;
    confirm?: string;
}

/**
 * Qué ha pasado, o qué pasaría con `preview`.
 *
 * @property effects     - Lo que le ocurre al reparto y a los cambios acordados.
 * @property fingerprint - Huella de los efectos, de la rueda de después y de las anclas con su cola: es lo que se
 *                         confirma. Cambia si cambia cualquiera de ellas.
 * @property applied     - `true` si se ha escrito; `false` en una vista previa.
 */
export interface IRepartoOUT {
    effects: IEfectosReparto;
    fingerprint: string;
    applied: boolean;
}

/**
 * Lo que le pasa al reparto de la guardia cuando se mueve —alta, baja, reordenado, reseteo, crear o borrar un
 * salto— y **cómo afecta a los cambios ya acordados** entre personas (`on_call_override`).
 *
 * Es el contrato de la vista previa de la baja de la rueda, y está pensado para reutilizarse en las demás
 * operaciones que mueven el reparto: no habla de la baja, habla de lo que le ocurre a cada cambio. Todos los
 * nombres vienen **ya resueltos** por el backend (nadie que pinte esto tiene por qué conocer el padrón), y todas
 * las fechas son `YYYY-MM-DD`.
 *
 * La regla de fondo, que es la que explica casi todo lo de aquí: **un cambio acordado sigue al turno de la
 * persona a la que sustituía**, no a la fecha. Si el reparto se mueve, el cambio se mueve con él (`moved`). Y si
 * el turno desaparece o quien lo cubre ya no puede, el cambio se resuelve: se anula (`annulled`), o —si la otra
 * persona ya había hecho su parte— se le da su turno por hecho (`waived`).
 */

/**
 * Por qué se ha tenido que resolver un cambio, en vez de moverlo con su turno.
 *
 * - `holder-leaves`        — la persona a la que sustituía el cambio (su titular) sale de la rueda, y su turno
 *                            desaparece con ella.
 * - `cover-leaves`         — quien cubría el tramo sale de la rueda, así que no puede hacerlo.
 * - `cover-absent`         — quien cubría el tramo tendría un salto (una ausencia) en los días a los que llega el
 *                            cambio.
 * - `turn-lost`            — el turno del titular se pierde por una dispensa o un salto nuevos, así que no hay
 *                            nada que cubrir.
 * - `no-turn`              — no se encuentra el turno equivalente, o el turno equivalente se pierde por una
 *                            ausencia que ya existía. Solo sale como conflicto.
 * - `lands-on-holiday`     — un tramo **parcial** (días sueltos o media semana) caería en un festivo que no lo era
 *                            en su sitio de origen: no se sabe a quién darle ese día. Solo sale como conflicto.
 * - `cover-leaves-unowned` — quien sale cubre un tramo futuro que ninguna rueda sabía de quién era, así que no hay
 *                            titular al que devolvérselo. Solo sale como conflicto.
 */
export type TEfectoMotivo = "holder-leaves"|"cover-leaves"|"cover-absent"|"turn-lost"|"no-turn"|"lands-on-holiday"|"cover-leaves-unowned";

/**
 * Por qué se **avisa** de algo sin tocarlo.
 *
 * - `current-week`        — quien sale cubre un tramo de la semana en curso; ya ha empezado y no se mueve.
 * - `holiday-beyond-feed` — un cambio sobre un festivo cuyo turno cae más allá de los festivos cargados: se queda
 *                           donde está. La importación de festivos no recoloca: se revisará en la próxima operación sobre la rueda.
 * - `turn-not-credited`   — se anula la parte futura de un cambio cuya otra parte ya se había hecho, y el turno de
 *                           esa persona **no** se da por hecho —solo se da cuando quien tenía que devolverlo sale
 *                           de la rueda—: tendrá que hacer su turno.
 */
export type TEfectoAviso = "current-week"|"holiday-beyond-feed"|"turn-not-credited";

/**
 * Una semana cuyo titular cambia, mirando solo las próximas (unas veintiséis).
 *
 * @property monday - Lunes de la semana.
 * @property before - Quién la cubre **ahora** (con los cambios aplicados), o ausente si nadie.
 * @property after  - Quién la cubriría después, o ausente si nadie.
 */
export interface IEfectoSemana {
    monday: string;
    before?: string;
    after?: string;
}

/**
 * Un tramo de un cambio acordado.
 *
 * @property from      - Primer día, inclusive.
 * @property to        - Último día, inclusive. Igual que `from` en un cambio de un día.
 * @property coveredBy - Quién cubre el tramo.
 * @property holder    - A quién le tocaba por rueda (su titular), si se conoce.
 */
export interface IEfectoTramo {
    from: string;
    to: string;
    coveredBy: string;
    holder?: string;
}

/**
 * Un cambio que se mueve con el turno de su titular.
 *
 * @property newFrom - Primer día del tramo después del movimiento.
 * @property newTo   - Último día.
 */
export interface IEfectoMovido extends IEfectoTramo {
    newFrom: string;
    newTo: string;
}

/**
 * Un cambio acordado que **se anula**, agrupado como se acordó: las filas de un mismo intercambio van juntas, y
 * un cambio suelto va solo.
 *
 * @property reason - Por qué (`TEfectoMotivo`).
 * @property ranges - Los tramos futuros que se borran, en orden.
 */
export interface IEfectoAnulado {
    reason: TEfectoMotivo;
    ranges: IEfectoTramo[];
}

/**
 * Un turno que se **da por hecho**: la persona ya había cubierto un tramo de la otra en ese cambio, así que no
 * tiene que hacer además su semana (o su festivo) teórica, y la cola corre un puesto.
 *
 * @property user    - A quién se le da por hecho.
 * @property cycle   - Qué ciclo: semanal o de festivos.
 * @property date    - Lunes de la semana o fecha del festivo cuyo turno se da por hecho.
 * @property covered - Lo que había cubierto ya, y cuándo.
 */
export interface IEfectoDispensa {
    user: string;
    cycle: EOnCallCycle;
    date: string;
    covered: IEfectoTramo;
}

/**
 * Un día suelto que vuelve a su titular porque quien lo cubría sale, cuando el titular **ya había hecho** su parte
 * del cambio: no es una semana, así que no se le puede dar por hecha, y se le avisa de que le vuelve ese día.
 *
 * @property from - Primer día, inclusive.
 * @property to   - Último día, inclusive.
 * @property user - A quién vuelve.
 */
export interface IEfectoDevuelto {
    from: string;
    to: string;
    user: string;
}

/**
 * Un salto de turno afectado por la baja: el de quien sale se borra, y el de otra persona cuyos días sueltos
 * cubría quien sale se amplía a semanas completas.
 *
 * @property user    - A quién se le saltaba el turno.
 * @property from    - Primer día del salto **antes**.
 * @property to      - Último día **antes**.
 * @property newFrom - Primer día después, solo si el salto se amplía.
 * @property newTo   - Último día después, solo si el salto se amplía.
 */
export interface IEfectoSalto {
    user: string;
    from: string;
    to: string;
    newFrom?: string;
    newTo?: string;
}

/**
 * Una solicitud de cambio pendiente que se cancela porque una de las dos personas sale de la rueda.
 *
 * @property userFrom - Quién la pidió.
 * @property userTo   - A quién se le pidió.
 * @property from     - Tramo que cedía quien pedía.
 * @property to       - Tramo de la otra persona, o ausente si era una cesión.
 */
export interface IEfectoSolicitud {
    userFrom: string;
    userTo: string;
    from: string;
    to?: string;
}

/**
 * Algo que se avisa sin tocarlo.
 *
 * @property reason    - Por qué (`TEfectoAviso`).
 * @property from      - Primer día del tramo.
 * @property to        - Último día.
 * @property coveredBy - Quién lo cubre, o a quién afecta.
 */
export interface IEfectoAviso {
    reason: TEfectoAviso;
    from: string;
    to: string;
    coveredBy?: string;
}

/**
 * Cómo queda una vuelta de un ciclo: el resto de la vuelta en curso y la siguiente.
 *
 * «Vuelta» es el paso del puntero del reparto por la lista de arriba abajo, una vez por persona. Reordenar la rueda
 * nunca hace que alguien se salte una vuelta ni que repita en la misma: lo que faltaba de esta vuelta se hace
 * entero, y la siguiente sigue el orden de la rueda nueva.
 *
 * @property cycle   - Qué ciclo.
 * @property current - Quién tiene el turno ahora y quiénes faltan por hacer el suyo en esta vuelta, en orden.
 * @property next    - El orden de la vuelta siguiente: la rueda nueva.
 */
export interface IEfectoRonda {
    cycle: EOnCallCycle;
    current: string[];
    next: string[];
}

/**
 * Una exención de un salto: el tramo en el que el contador **no cuenta** ese salto, porque todos los días de
 * ausencia de la persona los cubren cambios a nombre de otra.
 *
 * @property user  - A quién se le salta el turno.
 * @property cycle - Ciclo del tramo.
 * @property date  - Lunes de la semana o fecha del festivo.
 */
export interface IEfectoExencion {
    user: string;
    cycle: EOnCallCycle;
    date: string;
}

/**
 * Una dispensa que ya existía y se **borra** porque no cae en ningún turno de su persona.
 */
export interface IEfectoDispensaQuitada {
    user: string;
    cycle: EOnCallCycle;
    date: string;
}

/**
 * Un tramo que se quedaría sin nadie de guardia.
 *
 * @property from - Primer día, inclusive.
 * @property to   - Último día, inclusive.
 */
export interface IEfectoHueco {
    from: string;
    to: string;
}

/**
 * Algo que **impide** hacer el cambio tal y como está pedido, y que no se resuelve solo.
 *
 * @property reason    - Por qué (`TEfectoMotivo`).
 * @property from      - Primer día del tramo del cambio que estorba, si es de un cambio.
 * @property to        - Último día.
 * @property coveredBy - Quién lo cubre.
 * @property holder    - A quién le tocaba por rueda.
 */
export interface IEfectoConflicto {
    reason: TEfectoMotivo;
    from?: string;
    to?: string;
    coveredBy?: string;
    holder?: string;
}

/**
 * El resultado completo de mover el reparto.
 *
 * @property rounds             - Cómo queda la vuelta de cada ciclo: el resto de la vuelta en curso y la siguiente.
 * @property weeks              - Semanas que cambian de manos en las próximas, antes y después.
 * @property moved              - Cambios que siguen al turno de su titular: de dónde a dónde.
 * @property annulled           - Cambios que se anulan, por grupo.
 * @property waived             - Turnos que se dan por hechos.
 * @property daysReturned       - Días sueltos que vuelven a quien ya había hecho su parte.
 * @property skipsRemoved       - Saltos que se borran.
 * @property skipsExtended      - Saltos que se amplían a semanas completas.
 * @property hiddenRemoved      - Cambios que ya estaban tapados del todo por otros más recientes y que no se podían
 *                                recolocar: se retiran, no cambian nada de lo que se ve.
 * @property waiversRemoved     - Dispensas que ya existían y no caen en ningún turno de su persona: se borran.
 * @property exemptions         - Exenciones que se guardan con un salto nuevo.
 * @property exemptionsRemoved  - Exenciones que ya no se cumplen y se quitan: el salto vuelve a contar ahí.
 * @property uncovered          - Días que se quedan sin nadie de guardia y que estaban cubiertos.
 * @property requestsCancelled  - Solicitudes pendientes que se cancelan.
 * @property warnings           - Lo que se avisa sin tocarlo.
 * @property conflicts          - Lo que impide aplicarlo. Con alguno, no se puede confirmar.
 */
export interface IEfectosReparto {
    rounds: IEfectoRonda[];
    weeks: IEfectoSemana[];
    moved: IEfectoMovido[];
    annulled: IEfectoAnulado[];
    waived: IEfectoDispensa[];
    daysReturned: IEfectoDevuelto[];
    skipsRemoved: IEfectoSalto[];
    skipsExtended: IEfectoSalto[];
    hiddenRemoved: IEfectoTramo[];
    waiversRemoved: IEfectoDispensaQuitada[];
    exemptions: IEfectoExencion[];
    exemptionsRemoved: IEfectoExencion[];
    uncovered: IEfectoHueco[];
    requestsCancelled: IEfectoSolicitud[];
    warnings: IEfectoAviso[];
    conflicts: IEfectoConflicto[];
}

/**
 * Si los efectos traen algo que **hay que confirmar**: lo que se mueve, se anula, se da por hecho o se toca. Es lo
 * que decide si una operación del reparto se aplica directamente o exige haber visto la vista previa. Lo usan el
 * backend (para rechazar un `confirm` ausente) y la pantalla (para saltarse el diálogo cuando no hay nada que
 * enseñar), y por eso vive aquí y no en uno de los dos.
 *
 * @param efecto - Lo que ha calculado el backend.
 * @returns `true` si la operación no se puede aplicar sin confirmar.
 */
export const requiereConfirmar = (efecto: IEfectosReparto): boolean => {
    return efecto.moved.length > 0 ||
        efecto.annulled.length > 0 ||
        efecto.waived.length > 0 ||
        efecto.daysReturned.length > 0 ||
        efecto.skipsRemoved.length > 0 ||
        efecto.skipsExtended.length > 0 ||
        efecto.requestsCancelled.length > 0 ||
        efecto.exemptions.length > 0 ||
        efecto.exemptionsRemoved.length > 0 ||
        efecto.waiversRemoved.length > 0 ||
        efecto.hiddenRemoved.length > 0 ||
        efecto.uncovered.length > 0;
}
