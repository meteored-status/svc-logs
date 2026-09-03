/**
 * Editor: Bixus
 * Fecha: Tue, 25 Aug 2026 12:44:08 GMT
 * Hash: 3314ecc7b21b7d0b899cde5398f60806
 * Versión: 2026.8.25+7-bixus
 * Anterior: 2026.8.25+5-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

/**
 * Las formas de cambiar la guardia entre dos personas. **Todas** se materializan como filas de
 * `on_call_override` —que ya pisan la rotación— así que ninguna toca el orden de la rueda ni los ciclos: lo
 * que cambia es quién cubre unos tramos concretos.
 *
 * Van en dos familias, y la diferencia entre ellas es **sobre qué serie se cuenta**: las semanas van una detrás
 * de otra en el calendario, y los festivos van por su **propio ciclo** —el festivo número K le toca a la
 * posición K de la rueda—, así que dos festivos consecutivos pueden estar a tres meses de distancia y las
 * semanas de en medio no tienen nada que ver con ellos.
 *
 * - `WEEK`    — se cambian **una semana por la otra**, y solo entre las dos personas. Dos tramos, dos filas.
 * - `DAY`     — igual pero con **un día por otro**.
 * - `CASCADE` — la otra persona **ocupa la semana** y todos los que hay en medio **retrasan la suya una
 *               semana**, hasta llegar a la semana que se ha cedido.
 *
 *               Es un *move* de lista y **cierra solo**: con las semanas `[W1,W2,W3,W4]` en manos de
 *               `[A,B,C,D]`, mover A junto a D deja `[B,C,A,D]`. Nadie gana ni pierde turnos —cada uno sigue
 *               haciendo una guardia dentro del tramo— y fuera del tramo no se toca nada. Por eso no hay deuda
 *               que arrastrar, al contrario que en un salto.
 *
 *               Con las dos personas en semanas contiguas da exactamente lo mismo que `WEEK`, y eso es
 *               coherente y no un caso especial: mover un elemento junto al de al lado es intercambiarlos.
 * - `HOLIDAY`  — se cambian **un festivo por otro**. Es un día por otro, pero sobre la serie de festivos: solo
 *               se pueden elegir festivos, y de cada persona los que le toquen **por la rueda de festivos**.
 *               No es lo mismo que `DAY` sobre un día que resulta ser festivo, aunque la fila que escribe sea
 *               idéntica: la diferencia está en qué se ofrece y en que se comprueba que los dos días lo sean
 *               —un «cambio de festivo» sobre un día normal no significa nada—.
 * - `HOLIDAY_CASCADE` — el arrastre, pero **sobre la serie de festivos**: quien cede se coloca junto al festivo
 *               de la otra persona y los que hay en medio corren **un festivo** cada uno. Lo que se desplaza es
 *               la posición en el ciclo de festivos, no semanas de calendario, así que un arrastre de cuatro
 *               festivos puede abarcar medio año sin tocar ninguna semana.
 */
export enum EOnCallSwap {
    WEEK            = 0,
    DAY             = 1,
    CASCADE         = 2,
    HOLIDAY         = 3,
    HOLIDAY_CASCADE = 4,
}

/**
 * Cambio de guardia entre dos personas.
 *
 * @property type  - Tipo de cambio (`EOnCallSwap`).
 * @property userA - Quien **cede** el tramo. Es la persona desde cuya fila se abrió el diálogo.
 * @property userB - Quien lo **recibe**. Las dos tienen que estar en la rueda y ser distintas.
 * @property dateA - El tramo que cede `userA`. En `DAY` es el día exacto; en `WEEK` y `CASCADE`, cualquier
 *                   día de la semana —el backend lo expande a su lunes—; en `HOLIDAY` y `HOLIDAY_CASCADE`, la
 *                   fecha del festivo, que tiene que ser un festivo registrado y estar cubierto por esa
 *                   persona.
 * @property dateB - El tramo de `userB`, con el mismo criterio. **Obligatorio en todos los tipos.**
 *
 *                   En `CASCADE` lo fue opcional durante una versión, porque el backend buscaba la semana de
 *                   `userB` hacia delante desde la cedida. Era un error: ceder una semana a quien acababa de
 *                   tener la suya daba un tramo de una vuelta entera de rueda —19 semanas en el caso que lo
 *                   destapó— cuando la que se quería estaba unas pocas atrás. Ahora las dos las elige quien
 *                   hace el cambio y el tramo va de la más temprana a la más tardía, sin búsqueda que pueda
 *                   irse lejos.
 *
 *                   Es obligatorio **en el tipo** y no solo validado en tiempo de ejecución a propósito: con
 *                   `dateB?` el compilador dejaba pasar un `undefined` desde el diálogo, que es exactamente
 *                   el fallo que hubo al hacer el cambio anterior.
 */
export interface ISwapIN {
    type: EOnCallSwap;
    userA: number;
    userB: number;
    dateA: string;
    dateB: string;
}

/**
 * Deshace un cambio de guardia: borra **todas** las filas que creó.
 *
 * Va por el identificador del grupo y no por el id de una fila porque un cambio no es una fila: un intercambio
 * deja dos y un arrastre hasta veintisiete, y deshacer la mitad deja el reparto descompensado —alguien
 * cubriendo dos semanas y otro ninguna—.
 *
 * El backend lo **rechaza si hay cambios posteriores** sobre esos mismos tramos, y no es una precaución
 * genérica: después de un arrastre la gente sigue organizándose entre sí, y esos cambios individuales están
 * apoyados en el reparto que dejó el arrastre. Quitarlo por debajo los dejaría cediendo tramos que su dueño ya
 * no tiene, sin que falle nada. El mensaje dice cuáles son para que se pueda decidir.
 *
 * @property swap - Identificador del cambio, el que viaja en `IOnCallOverride.swap`.
 */
export interface ISwapDeleteIN {
    swap: string;
}
