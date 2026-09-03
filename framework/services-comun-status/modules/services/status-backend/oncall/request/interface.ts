/**
 * Editor: Bixus
 * Fecha: Mon, 31 Aug 2026 08:50:39 GMT
 * Hash: c76f2e42ff6af9a8862ae7fd4079fc4b
 * Versión: 2026.8.31+2-bixus
 * Anterior: 2026.8.31+1-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

import {EOnCallSwap} from "../swap/interface";

/**
 * Los tipos de cambio que **se pueden pedir**: los simples, y solo esos.
 *
 * Un arrastre mueve también a quien está en medio, o sea a gente que no participa en la conversación, así que
 * no es algo que dos personas puedan acordar entre ellas — para eso está la pantalla de administración, con su
 * permiso. Aquí solo caben los cambios cerrados entre dos.
 *
 * Se declara como lista y no como un subconjunto del enum porque hay que validarla en el servidor: la petición
 * viene de fuera y `EOnCallSwap` acepta cinco valores.
 */
export const SWAPS_SOLICITABLES: EOnCallSwap[] = [EOnCallSwap.WEEK, EOnCallSwap.DAY, EOnCallSwap.HOLIDAY];

/**
 * En qué ha acabado una solicitud. Se guarda en la columna `status` de `on_call_swap_request`, así que los
 * valores son parte del esquema y no se reordenan.
 *
 * Existe porque la fila **no se borra al responderla**, y eso no es un capricho de historial: un cambio se
 * puede pedir a varias personas, y en cuanto una acepta las demás se anulan. A esas otras hay que poder
 * decirles qué pasó cuando abran su enlace del correo, y «esa solicitud ya no existe» valdría igual para que
 * se la hubieran cancelado, para que ya la hubieran respondido o para que otra persona se les adelantara.
 *
 * - `PENDING`    — sin responder. Es la única que se enseña en el panel y la única sobre la que se puede actuar.
 * - `ACCEPTED`   — aceptada, con el cambio ya escrito.
 * - `REJECTED`   — rechazada por quien la recibió.
 * - `CANCELLED`  — retirada por quien la pidió.
 * - `SUPERSEDED` — anulada sola: otra persona aceptó el mismo tramo. Nadie la respondió, y por eso no es
 *                  `REJECTED` — quien la recibió no dijo que no, se quedó sin la pregunta.
 */
export enum EOnCallRequestStatus {
    PENDING    = 0,
    ACCEPTED   = 1,
    REJECTED   = 2,
    CANCELLED  = 3,
    SUPERSEDED = 4,
}

/**
 * Pedir un cambio de guardia: a alguien concreto, o **a toda la rueda a la vez**.
 *
 * Las dos fechas van **desde el punto de vista de quien pide**: `dateMine` es su tramo, el que cede, y
 * `dateTheirs` el de la otra persona. Se nombran así y no `dateA`/`dateB` como en `/swap` a propósito: ahí las
 * pone quien administra la guardia, mirando el reparto de otros dos; aquí una es tuya y la otra no, y
 * confundirlas es pedir justo el cambio contrario.
 *
 * **Sin `user` la solicitud sale para toda la rueda**, una por persona y cada una contra **su próximo turno**.
 * Es lo que resuelve el caso real de «necesito soltar esta semana y me da igual con quién»: pedirlo de uno en
 * uno obliga a elegir a alguien —y a elegir mal, porque quien pide no sabe a quién le viene bien— y a esperar
 * su respuesta antes de probar con el siguiente. Cada destinatario recibe una solicitud normal, y la primera
 * que se acepta anula las demás (`SUPERSEDED`): el tramo solo se cede una vez.
 *
 * De ahí sale que en ese modo **`dateTheirs` no se pueda mandar**, y no es una restricción arbitraria: la
 * devolución es distinta para cada destinatario —el próximo turno de cada uno— así que no hay una sola fecha
 * que poner. Mandarla se rechaza en vez de ignorarse, que un campo que se traga en silencio es un campo que
 * alguien cree que funciona.
 *
 * @property type       - Qué se cambia: semana, día o festivo. Solo los de `SWAPS_SOLICITABLES`.
 * @property user       - A quién se le pide, o **ausente para pedírselo a toda la rueda**.
 * @property dateMine   - El tramo propio. En los cambios de semana vale cualquier día de ella: el servidor lo
 *                        normaliza al lunes antes de guardarlo.
 * @property dateTheirs - El tramo de la otra persona, o **ausente si no devuelve nada**. Ausente es una
 *                        **cesión**: le pides a alguien que te cubra un tramo y no le das nada a cambio. Vale
 *                        para cualquiera —dentro y fuera de la rueda— porque es un favor, y un favor no necesita
 *                        que la otra persona tenga turnos que ofrecer. Con quien no hace guardias es además el
 *                        único caso posible: no tiene nada que devolver.
 *
 *                        Sin `user` **no se admite**: ahí la devolución la pone el servidor, una por persona.
 * @property message    - Recado opcional. Sin él la solicitud se entiende igual —las fechas la explican—, así
 *                        que no se exige.
 */
export interface IRequestIN {
    type: EOnCallSwap;
    user?: number;
    dateMine: string;
    dateTheirs?: string;
    message?: string;
}

/**
 * Responder o retirar una solicitud, por su id.
 *
 * Es el mismo cuerpo para aceptar y para descartar, y quién puede hacer cada cosa lo decide el servidor con la
 * propia fila: aceptar solo puede quien la ha recibido, y descartar cualquiera de los dos —el que la recibió la
 * rechaza y el que la pidió la cancela. Son la misma operación sobre los datos (la fila se va) y por eso van
 * al mismo endpoint: distinguirlas en la API obligaría a comprobar dos veces lo mismo.
 *
 * `all` solo tiene sentido al **cancelar una propia** pedida a varias personas: la retira de todas de una vez.
 * Sin él se retiraría de una, y las demás seguirían en pie ofreciendo un tramo que ya no se quiere soltar — que
 * es peor que no haber podido cancelar, porque quien la pidió cree que lo ha hecho.
 *
 * @property id  - Identificador de la solicitud.
 * @property all - `true` para llevarse también las hermanas: las del **mismo tramo ofrecido**, que son las que
 *                 se crearon en la misma petición. Se ignora en las ajenas —rechazar es cosa de una— y en las
 *                 que no tienen hermanas no cambia nada.
 */
export interface IRequestActionIN {
    id: number;
    all?: boolean;
}

/**
 * Responder una solicitud **desde el enlace del correo**, sin sesión.
 *
 * El token es un UUID v4 que solo conoce quien recibió el correo, y es lo que sustituye a la sesión: dice qué
 * solicitud es y, a la vez, que quien lo presenta es su destinatario. No lleva a quién ni qué acción —eso lo
 * pone el endpoint— porque el token identifica una sola fila y una sola persona.
 *
 * Va en el cuerpo y no en la URL a propósito: un token en la ruta o en la query acaba en los logs de acceso
 * de todo lo que hay por el camino, y este es la llave de la solicitud. En el enlace del correo no hay más
 * remedio que llevarlo en la URL —es un enlace—, pero la petición que actúa sí puede no hacerlo.
 *
 * @property token - El UUID de la solicitud.
 */
export interface IRequestTokenIN {
    token: string;
}

/**
 * Una solicitud de cambio de guardia, tal y como se pinta.
 *
 * Lleva **los dos nombres resueltos** por lo mismo que los cambios y los saltos: quien la lee es una de las dos
 * personas y necesita saber quién es la otra, y resolverlo en el cliente contra la rueda fallaría justo cuando
 * la otra persona ya no está en ella.
 *
 * Y lleva `possible`, que es la parte que no es un dato guardado sino una comprobación **al servir**: entre que
 * se pide y se responde, el reparto se puede haber movido —un tercero cambia esa semana, alguien se salta el
 * turno— y entonces el cambio ya no se puede hacer. Se manda así en vez de dejar que falle al aceptar porque un
 * botón que solo puede dar error es peor que un botón que no está.
 *
 * @property id        - Identificador.
 * @property type      - Qué se cambia (`EOnCallSwap`, siempre uno de los simples).
 * @property mine      - `true` si la ha pedido quien la está leyendo. Es lo que decide qué se puede hacer con
 *                       ella —las propias se cancelan, las ajenas se aceptan o se rechazan— y lo calcula el
 *                       servidor para que la pantalla no tenga que comparar ids.
 * @property user      - La **otra** persona: a quien se le pide si es tuya, o quien te la pide si no. Se manda
 *                       ya resuelta desde el punto de vista de quien lee, que es como se lee la frase.
 * @property userName  - Su nombre.
 * @property dateMine  - El tramo de quien lee, el que **cede** si el cambio se hace. Ausente cuando lo que le
 *                       piden es cubrir sin devolución: ahí no cede nada.
 * @property dateTheirs - El tramo de la otra persona, el que **recibe**, o ausente si no hay devolución. Los
 *                       dos van orientados a quien lee y no a quien pidió: la fila dice «cedes esto, recibes
 *                       esto» sin que la pantalla tenga que darle la vuelta según de quién sea.
 *
 *                       Ojo con la orientación en las cesiones: quien **pide** cede su tramo y no recibe nada,
 *                       y quien la **recibe** cubre ese tramo y no cede nada. O sea que ahí `dateMine` es la
 *                       fecha del tramo para el que la pidió y `dateTheirs` lo es para el que la responde, y por
 *                       eso `oneWay` viaja aparte: sin él, la pantalla no sabría de qué lado está el hueco.
 * @property oneWay    - `true` si no hay devolución. Es una cesión y no un cambio, y la pantalla lo tiene que
 *                       decir con otras palabras: «te cubre» no es «os cambiáis».
 * @property message   - El recado, o cadena vacía.
 * @property created   - Cuándo se pidió, en milisegundos epoch.
 * @property possible  - Si el cambio se puede hacer **ahora mismo**: que cada uno siga cubriendo su tramo y, en
 *                       los festivos, que los dos días lo sigan siendo.
 * @property reason    - Por qué no, cuando `possible` es `false`. Es el mensaje de la regla que lo impide, el
 *                       mismo que daría el endpoint de cambio.
 */
export interface IOnCallRequest {
    id: number;
    type: EOnCallSwap;
    mine: boolean;
    user: number;
    userName: string;
    dateMine?: string;
    dateTheirs?: string;
    oneWay: boolean;
    message: string;
    created: number;
    possible: boolean;
    reason?: string;
}

/**
 * Lo que se enseña en la página del enlace, antes de responder.
 *
 * La página existe **porque el enlace no actúa**, y esa es la decisión que hay detrás de este payload: un
 * enlace de correo que aceptara el cambio al abrirse lo aceptaría también cuando lo abre un antivirus o el
 * escáner de enlaces del cliente de correo, que visitan cada URL de cada mensaje. Así que el enlace enseña la
 * solicitud y la respuesta la da un botón.
 *
 * Y como se enseña sin sesión, aquí solo viaja lo que ya iba en el propio correo: los dos nombres, las fechas
 * y el recado. Nada del reparto de nadie más.
 *
 * @property request    - La solicitud orientada a **quien la recibió**, igual que se pinta en su ficha: `mine`
 *                        es siempre `false` y `possible` dice si todavía se puede aceptar. Se reutiliza el
 *                        mismo tipo que la ficha para que las dos pantallas digan lo mismo con las mismas
 *                        palabras.
 * @property recipient  - El nombre de quien la recibió, para saludarle. En la ficha no hace falta —es quien
 *                        está mirando— y aquí sí: quien abre el enlace no se ha identificado, así que el
 *                        nombre es lo que le confirma que el correo era para él.
 * @property resolution - Cómo acabó, **presente solo si ya no está pendiente**. Es lo que convierte un enlace
 *                        caducado en una respuesta: con las peticiones a varias personas, quien no llega
 *                        primero abre siempre un enlace que ya no vale, y lo que necesita saber es que su
 *                        turno está cubierto y por quién. Ausente significa pendiente, y entonces la página
 *                        pinta los botones.
 */
export interface IRequestTokenOUT {
    request: IOnCallRequest;
    recipient: string;
    resolution?: IRequestResolution;
}

/**
 * El desenlace de una solicitud ya respondida, para contarlo en la página del enlace.
 *
 * @property status   - Cómo acabó. `SUPERSEDED` es el caso que da sentido a todo esto: otra persona aceptó el
 *                      mismo tramo, así que a quien lee no le queda nada que hacer.
 * @property userName - Quién la resolvió, o `null` si esa cuenta ya no existe. En `SUPERSEDED` es quien se
 *                      quedó el tramo, que es el dato que se ha venido a buscar.
 * @property when     - Cuándo, en milisegundos epoch. Se manda el instante y no una frase hecha para que la
 *                      pantalla lo escriba en la zona de quien lo lee.
 */
export interface IRequestResolution {
    status: EOnCallRequestStatus;
    userName: string|null;
    when: number;
}
