/**
 * Editor: Bixus
 * Fecha: Wed, 26 Aug 2026 10:32:05 GMT
 * Hash: 40e68169354b70de005b8c9b83bbbb0c
 * Versión: 2026.8.26+3-bixus
 * Anterior: 2026.8.26+1-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

/**
 * Tipos compartidos de la guardia (*on-call*).
 *
 * Tres conceptos que se parecen y no son lo mismo, y que conviene no confundir al leer esto:
 *
 * - **La rueda** — quién participa en el turno rotatorio (`user.on_call_rotation`) y en qué orden
 *   (`user.on_call_order`). Es un padrón: lo administra una persona y cambia poco.
 * - **El turno de hoy** — quién está de guardia hoy (`user.on_call`). Lo reescribe el cronjob en cada pasada
 *   resolviéndolo **de la planificación**, con el calendario de Google solo como respaldo para cuando la rueda
 *   no tiene respuesta (vacía, o todos saltados). De esa columna salen tanto el aviso del AppBar como el
 *   destinatario de los correos de aviso, así que las dos cosas no pueden discrepar.
 * - **La planificación** — a quién le tocará cada semana según la rueda, los festivos y los cambios. Se
 *   calcula, no se guarda; el registro de lo que ya pasó sí (`on_call_log`).
 */

/**
 * Los dos ciclos de la guardia. Recorren la **misma** rueda de gente pero con contadores independientes
 * —uno avanza una posición por semana y el otro una por festivo—, y eso es lo que hace que los festivos no
 * caigan siempre en las mismas manos: van ~14 al año contra 52 semanas, así que las dos series se
 * desacoplan solas.
 *
 * Vive aquí y no en `status-backend-base` para no tenerlo duplicado: el paquete de negocio lo importa de
 * este contrato, igual que hace con `EUserStatus`.
 */
export enum EOnCallCycle {
    WEEK    = 0,
    HOLIDAY = 1,
}

/**
 * Desde dónde se está contando un ciclo, para poder decirlo en la pantalla.
 *
 * @property cycle       - Qué ciclo.
 * @property anchorDate  - Fecha de referencia. En el ciclo semanal es un **lunes**; en el de festivos, la
 *                         **fecha del festivo** de referencia.
 * @property anchorIndex - Posición de la rueda que le corresponde a esa fecha. Es una posición y no un
 *                         usuario a propósito (ver `on_call_cycle` en el alter), con una consecuencia que
 *                         conviene enseñar: **reordenar la rueda después de un reseteo cambia a quién le
 *                         toca**.
 */
export interface IOnCallCycleInfo {
    cycle: EOnCallCycle;
    anchorDate: string;
    anchorIndex: number;
}

/**
 * Un salto de turno: un tramo en el que a alguien **no se le adjudican** guardias.
 *
 * No confundir con `IOnCallOverride`, que es lo otro que pisa la rotación: un **cambio** dice «este tramo lo
 * cubre esta otra persona» y nombra al sustituto; un **salto** dice «a esta persona no le adjudiques nada
 * estos días».
 *
 * Lo que hace el salto con el reparto no es pasarle la guardia al siguiente: al que queda fuera el contador **no
 * le gasta turno**, así que durante una baja larga los disponibles se van alternando en vez de que uno haga dos
 * semanas seguidas. La contrapartida es que la cola se desplaza — las semanas de después del tramo cambian de
 * manos.
 *
 * Y quién queda fuera se decide distinto en cada ciclo:
 *
 * - En la guardia **semanal**, basta con que el salto toque **un solo día** de la semana: la semana pasa entera
 *   a la siguiente persona. Irse un miércoles o volver un miércoles no deja media guardia — deja una guardia que
 *   no es tuya, porque en las dos mitades tiene que haber alguien localizable.
 * - En la de **festivos** se mira la **fecha exacta** del festivo. Van por su propio ciclo, así que el festivo de
 *   alguien cae normalmente dentro de la semana de otro, y un salto que se lleva tu semana no se lleva el festivo
 *   si este cae fuera del tramo.
 *
 *   Al contrario sí arrastra: un tramo que cubre la fecha del festivo se lleva el festivo **y** la semana en la
 *   que cae, porque el festivo es también un día de esa semana. Los dos ciclos son independientes en el reparto,
 *   no en lo que tapa un salto.
 *
 * En los dos casos el turno saltado **no se recupera**: quien vuelve no debe guardias ni se le deben.
 *
 * @property id        - Identificador del salto.
 * @property dateFrom  - Primer día del tramo, `YYYY-MM-DD`, inclusive.
 * @property dateTo    - Último día, inclusive. Un salto de un día tiene `dateFrom === dateTo`.
 * @property user      - Quién se salta los turnos.
 * @property userName  - Su nombre, resuelto por el backend.
 * @property reason    - Por qué. Siempre viene: un salto le quita turnos a alguien y se lo pone a otro, así
 *                       que sin el motivo el dato no se puede interpretar tres meses después.
 * @property created   - Cuándo se creó, en milisegundos epoch.
 * @property createdBy - Id de quien lo creó.
 * @property createdByName - Su nombre, y **por eso viaja resuelto**: quien administra la guardia no tiene por
 *                       qué estar en la rueda —de eso van los permisos `status.oncall.*`—, así que resolverlo
 *                       en el cliente contra la rueda falla en el caso **normal** y no en el raro. Enseñaba un
 *                       «puesto por #1» que parecía un puesto o una posición y era un id de usuario.
 *
 *                       Los dos nombres van con la fila y no en un mapa aparte de ids a nombres: son dos
 *                       cadenas por salto, y el mapa habría que acordarse de mirarlo — con el nombre en la
 *                       fila, no hay nada que resolver.
 */
export interface IOnCallSkip {
    id: number;
    dateFrom: string;
    dateTo: string;
    user: number;
    userName: string;
    reason: string;
    created: number;
    createdBy: number;
    createdByName: string;
}

/**
 * De dónde sale un turno pasado, en orden de menos a más deducido. La pantalla **tiene** que distinguirlos:
 * no es lo mismo «esta guardia la hiciste» que «esta guardia te habría tocado».
 *
 * - `LOGGED` — del registro diario (`on_call_log`), escrito **el día que pasó**. Un hecho: no cambia aunque
 *   después se saque a alguien de la rueda, se reordene o se resetee un ciclo.
 * - `BACKFILLED` — del registro, pero de una fila que el cronjob **recuperó** al detectar que se había
 *   perdido ese día. Es una reconstrucción, aunque de las buenas: se hizo a los pocos días, con la rueda casi
 *   idéntica a la de entonces, y quedó congelada. Más fiable que `COMPUTED` y menos que `LOGGED`.
 * - `COMPUTED` — no hay fila: es el reparto de aplicar la rueda **de hoy** a esa fecha, calculado al servir la
 *   respuesta. Es lo único que se puede decir de lo anterior a la puesta en marcha del registro. Los cambios y
 *   los saltos guardados entran en el cálculo —esos son reales—, pero la composición y el orden de la rueda de
 *   entonces no se conocen, así que pudo haber sido otra persona.
 */
export enum EOnCallPastSource {
    LOGGED     = 0,
    BACKFILLED = 1,
    COMPUTED   = 2,
}

/**
 * Un turno **ya pasado** de una persona: una semana o un festivo que le tocó, con su procedencia.
 *
 * La procedencia va **por elemento** y no como una fecha global de «desde aquí hay registro» a propósito: el
 * registro puede tener huecos y filas recuperadas entremezcladas, y una frontera única daría por registrado
 * lo que en realidad se dedujo.
 *
 * @property date   - Lunes de la semana, o fecha del festivo, `YYYY-MM-DD`.
 * @property source - De dónde sale (`EOnCallPastSource`).
 */
export interface IOnCallPast {
    date: string;
    source: EOnCallPastSource;
}

/**
 * Un usuario de la rueda.
 *
 * @property id     - Identificador interno (`user.id`).
 * @property name   - Nombre visible.
 * @property email  - Email.
 * @property avatar - URL del avatar, si tiene.
 * @property order  - Posición en la rueda. Es el índice dentro de la lista ya ordenada, así que es
 *                    redundante con la propia posición del array; va porque quien pinte un elemento
 *                    suelto (una celda de la planificación) no tiene el array a mano.
 * @property active - Si su cuenta puede entrar al panel. Va porque alguien en la rueda con la cuenta
 *                    baneada **no cubre turnos**, y esa es la clase de agujero que hay que ver de un
 *                    vistazo: su semana quedaría sin nadie.
 * @property nextWeek - Lunes de su próxima semana de guardia, `YYYY-MM-DD`, o ausente si no le toca ninguna
 *                    dentro del horizonte que mira el backend. Incluye la semana en curso si es suya.
 *
 *                    Lo calcula el backend buscando **hacia delante**, semana a semana, y no se deduce de su
 *                    posición en la rueda: con saltos y cambios de por medio, la semana que le tocaría por
 *                    posición puede no ser suya, y la siguiente tampoco.
 * @property weeks    - Los lunes de sus **próximas semanas** de guardia, en orden, incluida la actual si es
 *                    suya. Unas pocas, no todas: las que hacen falta para poder **elegir** una en el diálogo
 *                    de cambio de guardia.
 *
 *                    Van aparte de `IListOUT.weeks` porque son otra cosa: esa es la planificación de la
 *                    ventana que se pinta —unas pocas semanas— y estas van tan lejos como haga falta para reunir
 *                    unas cuantas suyas. Con una rueda de seis personas, la sexta semana propia cae a ocho
 *                    meses, o sea muy fuera de la ventana.
 *
 *                    Filtrar `IListOUT.weeks` por `coveredBy` **no** sirve para esto, y era el fallo: la
 *                    columna «próxima guardia» busca hasta dos años adelante, así que la tabla enseñaba una
 *                    fecha que el diálogo no podía ofrecer.
 * @property nextHolidayOwn - Fecha del próximo festivo que cubre, `YYYY-MM-DD`, o ausente.
 *
 *                    Ojo con el ausente: puede significar «no le toca ninguno» o «se acabaron los festivos
 *                    importados», y no se distinguen. El feed solo trae un par de años, así que quien lo
 *                    pinte no puede prometer que no le toque — solo que no se sabe.
 *
 *                    Se llama `nextHolidayOwn` y no `nextHoliday` para no chocar con el `nextHoliday` de
 *                    `IListOUT`, que es otra cosa: ese es el próximo festivo **del calendario**, sin
 *                    importar de quién sea.
 * @property holidays - Los próximos festivos que cubre, en orden. `nextHolidayOwn` es el primero de esta
 *                    lista; se mantienen los dos por lo mismo que `nextWeek` y `weeks` — una columna quiere
 *                    «el siguiente» y un registro quiere «los siguientes», y deducir uno del otro en cada
 *                    consumidor es la forma de que un día dejen de coincidir.
 *
 *                    No confundir con `IListOUT.holidays`, que son los festivos **del calendario** que caen
 *                    en la ventana que se pinta, de quien sea. Estos son solo los suyos.
 * @property pastWeeks - Sus **últimas** semanas de guardia, de la más reciente a la más antigua, sin incluir
 *                    la semana en curso —esa, si es suya, es la primera de `weeks`. Cada una dice si es un
 *                    dato registrado o una reconstrucción (`IOnCallPast`), y la pantalla **tiene** que
 *                    distinguirlas: no es lo mismo «esta guardia la hiciste» que «esta guardia te habría
 *                    tocado».
 * @property pastHolidays - Los **últimos** festivos que cubrió, del más reciente al más antiguo, con el mismo
 *                    criterio.
 *
 *                    De la parte **calculada al servir** (`COMPUTED`) hay que saber dos cosas. Una: si alguien
 *                    entró o salió de la rueda, o si se reordenó, el reparto de entonces pudo ser otro — la
 *                    rueda es la entrada del cálculo, así que tocarla reescribe lo que el cálculo dice del
 *                    pasado. Y dos: el backend la **recorta por el ancla del ciclo**, porque antes de un
 *                    reseteo el reparto era distinto con certeza y ahí no hay nada que reconstruir.
 *
 *                    Nada de eso afecta a la parte **registrada**, que es el motivo de que exista
 *                    `on_call_log`: una fila escrita el día que pasó no la mueve ningún cambio posterior.
 */
export interface IOnCallUser {
    id: number;
    name: string;
    email: string;
    avatar?: string;
    order: number;
    active: boolean;
    nextWeek?: string;
    weeks: string[];
    pastWeeks: IOnCallPast[];
    nextHolidayOwn?: string;
    holidays: string[];
    pastHolidays: IOnCallPast[];
}

/**
 * Un día festivo, tal y como lo pinta la planificación.
 *
 * @property date   - El día, `YYYY-MM-DD`.
 * @property name   - Nombre del festivo.
 * @property manual - Si es un alta manual y no del feed. Los del feed no se pueden borrar —volverían en
 *                    la siguiente pasada del cronjob—, así que es lo que decide si se ofrece la papelera.
 *                    El feed de Murcia trae los nacionales y los regionales, pero **no las dos fiestas
 *                    locales**, que son justo las que hay que dar de alta a mano.
 */
export interface IOnCallHoliday {
    date: string;
    name: string;
    manual: boolean;
}

/**
 * Un cambio puntual de guardia: una reasignación de un tramo, no un trueque.
 *
 * @property id        - Identificador del cambio.
 * @property dateFrom  - Primer día del tramo, `YYYY-MM-DD`, inclusive.
 * @property dateTo    - Último día, inclusive. Un cambio de un día tiene `dateFrom === dateTo`.
 * @property user      - Id de quien cubre el tramo.
 * @property userName  - Su nombre, resuelto por el backend.
 * @property created   - Cuándo se creó, en milisegundos epoch. Entre cambios que solapan gana el más
 *                       reciente, así que esto es lo que decide.
 * @property createdBy - Id de quien lo creó.
 * @property createdByName - Su nombre. Viaja resuelto por lo mismo que en `IOnCallSkip`: quien pone un cambio
 *                       no tiene por qué estar en la rueda, así que resolverlo contra ella falla en el caso
 *                       normal.
 * @property swap      - Identificador del **cambio de guardia** que creó esta fila, o ausente si es un cambio
 *                       suelto. Las filas que comparten `swap` son un solo cambio —un intercambio deja dos y un
 *                       arrastre hasta veintisiete— y se deshacen juntas: por eso la pantalla las agrupa y
 *                       ofrece una sola acción, en vez de una papelera por fila que dejaría el reparto a medias.
 */
export interface IOnCallOverride {
    id: number;
    dateFrom: string;
    dateTo: string;
    user: number;
    userName: string;
    swap?: string;
    created: number;
    createdBy: number;
    createdByName: string;
}

/**
 * Quién cubre un día concreto de la planificación.
 *
 * @property date     - El día, `YYYY-MM-DD`.
 * @property user     - Id de quien cubre, o `null` si la rueda está vacía.
 * @property holiday  - Nombre del festivo, si lo es. Su presencia explica por qué el día no le toca a
 *                      quien tiene la semana: los festivos van por su propia rueda.
 * @property override  - `true` si quien cubre sale de un cambio puntual y no de la rotación.
 * @property skipped   - Id de a quien le **tocaba** por rueda y se saltó el turno, cuando el día ha caído en
 *                       el siguiente por eso. Va el id y no un booleano porque lo que se quiere leer en la
 *                       pantalla es «le tocaba a Jose, que está de vacaciones».
 * @property uncovered - `true` cuando la rueda tiene gente pero **todos** están saltados ese día, así que no
 *                       hay nadie a quien adjudicarlo y `user` es `null`. Es un agujero real y hay que
 *                       pintarlo: se prefiere dejarlo visible a adjudicárselo a alguien que ha dicho que no
 *                       está, que sería una asignación que nadie va a cumplir. Distingue ese caso del de la
 *                       rueda vacía, en el que `user` también es `null` pero esto no viene.
 */
export interface IOnCallDay {
    date: string;
    user: number|null;
    holiday?: string;
    override?: boolean;
    skipped?: number;
    uncovered?: boolean;
}

/**
 * Una semana de la planificación, de lunes a domingo.
 *
 * @property monday - Lunes de la semana, `YYYY-MM-DD`.
 * @property user   - Quien tiene la semana **por rueda**, sin descontar festivos ni cambios. No es lo
 *                    mismo que quien cubre cada día: para eso está `days`.
 * @property coveredBy - Quién **cubre** la semana, que no es lo mismo que `user`: es la rueda semanal con los
 *                    saltos ya aplicados, o sea el primer día de la semana que no sea festivo ni cambio
 *                    puntual. Ausente si no cubre nadie.
 *
 *                    Viaja calculado para que la pantalla pueda preguntar «¿qué semanas son de esta
 *                    persona?» —lo necesitan los diálogos de cambio— sin reimplementar la regla: con ella en
 *                    el cliente, un día diría cosas distintas que el chip de «está de guardia» y que la
 *                    columna de «tu próxima semana», que salen de aquí.
 * @property days   - Los siete días, de lunes a domingo.
 */
export interface IOnCallWeek {
    monday: string;
    user: number|null;
    coveredBy?: number;
    days: IOnCallDay[];
}
