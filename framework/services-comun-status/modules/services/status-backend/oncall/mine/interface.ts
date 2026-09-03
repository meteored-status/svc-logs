/**
 * Editor: Bixus
 * Fecha: Wed, 26 Aug 2026 09:06:22 GMT
 * Hash: c983b5e805f08a566a8516a0ed045ffc
 * Versión: 2026.8.26+2-bixus
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
 */
export interface IMineOUT {
    today: string;
    user?: IOnCallUser;
    onCallWeek?: number;
    onCallHoliday?: number;
    requests: IOnCallRequest[];
    cycles: IOnCallCycleInfo[];
}
