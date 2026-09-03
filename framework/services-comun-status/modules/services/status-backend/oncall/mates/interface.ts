/**
 * Editor: Bixus
 * Fecha: Wed, 26 Aug 2026 09:06:22 GMT
 * Hash: 5152083d26ce89b14aa877464716a507
 * Versión: 2026.8.26+2-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

/**
 * Con quién se puede cambiar la guardia y qué tramos tiene cada uno.
 *
 * **Esto expone los turnos de otras personas**, y es una decisión, no un descuido: para proponer un cambio hay
 * que saber qué semanas tiene la otra persona, y sin eso la única forma de organizarlo sería preguntando por
 * fuera del panel — que es exactamente lo que esta pantalla viene a quitar. Se acota por los dos lados:
 *
 * - Solo lo pide **quien está en la rueda**, y el flow lo rechaza si no. Tener acceso al panel no basta.
 * - Solo viaja lo que hace falta para elegir un tramo: nombre, foto y fechas. **No** van el email, ni el orden
 *   en la rueda, ni si la cuenta está activa, ni los cambios y saltos con su motivo — todo eso sigue detrás de
 *   `status.oncall.list`, que es el permiso de administrar la guardia.
 *
 * Va en su propio endpoint y no dentro de `/mine` porque se pide **al abrir el diálogo** de solicitud y no al
 * cargar la ficha: calcular los turnos de toda la rueda en cada visita al perfil sería pagar el reparto completo
 * para pintar dos líneas.
 *
 * A la lista entran **también las cuentas que no hacen guardias**, con las tres listas vacías, porque a esas
 * también se les puede pedir un cambio: alguien que no está en la rueda puede cubrirte una semana sin devolverte
 * nada. Se distinguen por `inWheel`, y la diferencia importa en la pantalla —con ellas no hay tramo que elegir
 * del otro lado— y en el servidor, que exige la devolución justamente cuando la otra persona sí hace guardias.
 *
 * @property id       - Id, que es lo que viaja en la solicitud.
 * @property inWheel  - Si hace guardias. Con `false`, las tres listas van vacías: no tiene turnos que ofrecer.
 * @property name     - Nombre visible.
 * @property avatar   - Su foto, si tiene.
 * @property weeks    - Sus próximas semanas de guardia, por el lunes de cada una.
 * @property holidays - Los próximos festivos que cubre. Van por su propia rueda, así que no se deducen de las
 *                      semanas: el festivo de alguien cae normalmente en la semana de otro.
 * @property days     - Los días que cubre en las próximas semanas, para el cambio de un día suelto. Es una
 *                      ventana corta a propósito: «cúbreme el martes» es un cambio de esta semana o de la que
 *                      viene, y ofrecer días a ocho meses vista serían doscientas entradas en un desplegable.
 */
export interface IOnCallMate {
    id: number;
    name: string;
    avatar?: string;
    inWheel: boolean;
    weeks: string[];
    holidays: string[];
    days: string[];
}

/**
 * La rueda vista desde quien pregunta, para poder pedir un cambio.
 *
 * `mine` va aparte de `mates` y no como un elemento más de la lista porque las dos mitades del formulario no son
 * simétricas: de uno sale lo que se cede y del otro lo que se recibe, y tener que filtrarse a uno mismo de una
 * lista es la clase de detalle que se olvida — y olvidado, deja elegirse a uno mismo como la otra persona.
 *
 * @property today - Hoy en `Europe/Madrid`. Del servidor y no del navegador, igual que en el resto de la
 *                   guardia: es lo que decide qué tramos son futuros.
 * @property mine  - Los tramos de quien pregunta.
 * @property mates - El resto de la gente a la que se le puede pedir: primero la rueda en su orden y después las
 *                   cuentas activas que no hacen guardias, que también pueden cubrir. Van en una sola lista y no
 *                   en dos porque el desplegable es uno — quien elige no está eligiendo «de qué grupo», está
 *                   eligiendo una persona.
 */
export interface IMatesOUT {
    today: string;
    mine: IOnCallMate;
    mates: IOnCallMate[];
}
