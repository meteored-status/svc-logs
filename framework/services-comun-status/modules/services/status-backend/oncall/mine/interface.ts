/**
 * Editor: Bixus
 * Fecha: Mon, 21 Sep 2026 15:04:57 GMT
 * Hash: fee94378c594050c45fa63ce8d94da7f
 * Versión: 2026.9.21+3-bixus
 * Anterior: 2026.9.21+2-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

import type {IOnCallCycleInfo, IOnCallUser} from "../interface";
import type {IOnCallRequest} from "../request/interface";

/**
 * La guardia **de quien pregunta**: sus turnos, los que vienen y los que hizo.
 *
 * Va en su propio endpoint y con el permiso de estar en el panel (`status.panel.access`), no con
 * `status.oncall.list`, por lo mismo que `/today`: saber cuándo te toca a ti es tu propio dato. Administrar la
 * guardia es otra cosa y son otros permisos — la mayoría de quien hace guardias no los tiene, y esa gente es
 * justo la que necesita esta pantalla.
 *
 * Y por eso el payload es distinto del de `/list` en vez de ser el mismo filtrado: ahí viajan la rueda entera
 * con nombres, los cambios con quién los puso y los saltos con su motivo, o sea datos de terceros. Aquí no sale
 * nada que no sea suyo, y los dos ids que hay lo son **solo cuando coinciden con él**.
 *
 * @property today        - Hoy en `Europe/Madrid`, `YYYY-MM-DD`. Del backend y no del navegador, igual que en
 *                          `/list`: con el reloj del cliente, la semana «en curso» podría no ser la del reparto.
 * @property user         - Sus turnos ya calculados, o **ausente si no está en la rueda**. Ausente y no un
 *                          objeto vacío: «no haces guardias» y «no te toca ninguna» son cosas distintas y la
 *                          pantalla las cuenta distinto.
 * @property onCallWeek   - Su propio id, y **solo** si es él quien cubre la semana en curso; ausente en
 *                          cualquier otro caso. Es un id y no un booleano porque es lo que espera la ficha de
 *                          turnos, que es la misma que pinta la pantalla de administración — así las dos dicen
 *                          lo mismo sin dos implementaciones. Y es *su* id y nunca el de otro: quién más está
 *                          de guardia se pregunta a `/today`, que es donde ese dato lleva su permiso.
 * @property onCallHoliday - Igual, para el próximo festivo.
 * @property requests     - Las solicitudes de cambio de guardia en las que participa, las que le han pedido y
 *                          las que ha pedido él, con `mine` diciendo de cuál se trata. Van con los turnos y no
 *                          en un endpoint aparte porque se leen juntas —una solicitud no se entiende sin ver
 *                          qué semanas tienes— y porque responder una recarga las dos cosas.
 * @property cycles       - Los ciclos reseteados. Van porque son lo único que explica un registro vacío: sin
 *                          ellos, «sin guardias anteriores» se lee como «no has hecho ninguna» cuando lo que
 *                          pasa es que no se reconstruye nada anterior al reseteo. Son dos filas y no dicen
 *                          nada de nadie: una fecha y una posición de la rueda.
 * @property calendar     - Id del calendario de Google donde `cronjobs/status-control` publica la guardia, para
 *                          que la ficha pueda ofrecer el enlace de suscripción. **Ausente si el entorno no lo
 *                          tiene configurado**, y entonces no se ofrece — que es lo que tiene que pasar en un
 *                          despliegue sin calendario, en vez de un enlace roto.
 *
 *                          Viaja aquí y no en un endpoint propio porque se lee en la misma pantalla y en el
 *                          mismo momento, y porque una llamada de red para devolver una constante del entorno
 *                          es una llamada que puede fallar sola. No es un dato de nadie: el id no da acceso
 *                          —el calendario no es público y hace falta estar en su lista de permisos— así que no
 *                          cambia con quién pregunte, y por eso sale también para quien no está en la rueda.
 * @property shifts       - Sus tramos continuos de guardia que todavía no han terminado, en orden. Es lo que
 *                          hace falta para ofrecerle añadir **un turno suyo** a su propio calendario, que es
 *                          la única forma de que Google le avise a él y no a los doce: el calendario del
 *                          equipo lo ve como lector, y de un evento que no es suyo no recibe recordatorios.
 *                          Vacío si no le toca nada por delante. Ver `IOnCallShift` para por qué no vale
 *                          construirlos desde `weeks`.
 */
/**
 * Un tramo continuo de guardia de quien pregunta: desde cuándo hasta cuándo cubre sin interrupción, con los
 * dos extremos **inclusivos**.
 *
 * **No es lo mismo que una semana de `IOnCallUser.weeks`**, y esa es justo la razón de que exista. Ahí va el
 * lunes de cada semana que le toca, que es lo que se lee en la ficha; pero los días que cubre de verdad no
 * tienen por qué ser los siete: un festivo dentro de esa semana se reparte por su propia rueda y puede
 * caerle a otra persona. Quien construya un evento de calendario a partir del lunes y le sume seis días
 * acaba afirmando que alguien está de guardia un día que no lo está, y eso no se ve — el evento existe y
 * parece correcto.
 *
 * Sale de `tramos()` (`status-backend-base`), la **misma** función con la que `cronjobs/status-control`
 * publica el calendario del equipo, así que lo que alguien se añada a su calendario y lo que hay en el del
 * equipo coinciden por construcción y no por casualidad.
 *
 * @property from - Primer día del tramo, `YYYY-MM-DD`.
 * @property to   - Último día, igual que `from` en un tramo de un solo día.
 */
export interface IOnCallShift {
    from: string;
    to: string;
}

export interface IMineOUT {
    today: string;
    user?: IOnCallUser;
    onCallWeek?: number;
    onCallHoliday?: number;
    requests: IOnCallRequest[];
    cycles: IOnCallCycleInfo[];
    calendar?: string;
    shifts: IOnCallShift[];
}
