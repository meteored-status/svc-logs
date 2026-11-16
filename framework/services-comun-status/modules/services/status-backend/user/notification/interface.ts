/**
 * Editor: Bixus
 * Fecha: Mon, 16 Nov 2026 08:43:09 GMT
 * Hash: 6a05e147f306aa138e098b3de34147ed
 * Versión: 2026.11.16+2-bixus
 * Anterior: 2026.11.16+1-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

import type {EPermission} from "../../auth/interface";

/**
 * Los avisos que el panel manda por su cuenta, cada uno con su emisor.
 *
 * - `monitor`  — un monitor pasa a error o vuelve a OK (`Notification.notify()` del cronjob). Es el único
 *                urgente: algo está roto ahora mismo.
 * - `oncall`   — el aviso de las nueve a quien le toca guardia hoy (`Aviso` del cronjob). Programado.
 * - `anomaly`  — lo que se sale de lo normal en el consumo de Cloudflare (`Anomalias` del cronjob). Informativo.
 * - `crawl`    — lo que se sale de lo normal en el rastreo de Googlebot (`rastreo/anomalias.ts` del cronjob). Informativo.
 *                Nació de partir `anomaly`: los dos llevan a pantallas con permisos distintos, así que cada uno es
 *                un aviso con sus suscriptores.
 * - `swap`     — alguien te pide un cambio de guardia, o la solicitud que tenías se ha quedado sin efecto
 *                (`data/notification/oncall-swap.ts` de `status-backend`). **El único que no manda el
 *                cronjob**: nace de que otra persona pulsa un botón, no de una pasada periódica.
 *
 * **La lista vive aquí y no en cada emisor** porque la miran varios sitios: los emisores para decidir si mandan, y la
 * pantalla de preferencias para pintar las casillas. Con una copia por sitio, el día que entre un aviso nuevo la pantalla
 * no lo ofrecería y nadie se enteraría de que existe.
 *
 * Añadir uno es esta línea, su defecto y su entrada en `PERMISOS_SUSCRIPCION` de abajo: la pantalla saca la fila sola, el endpoint lo valida solo, y
 * el compilador obliga a darle rótulo —`ROTULO` en `session/user-notifications.tsx` es un `Record<TAviso, …>`,
 * así que no compila hasta que lo tiene—. Lo que no sale solo es el emisor.
 */
export const AVISOS = ["monitor", "oncall", "anomaly", "crawl", "swap"] as const;

/** Uno de los avisos del panel. */
export type TAviso = typeof AVISOS[number];

/**
 * Por dónde puede llegar un aviso.
 *
 * `push` son las notificaciones del navegador, que solo llegan a quien haya dado permiso y tenga la aplicación
 * instalada —en iOS, obligatorio—. Tener el canal activo y ningún dispositivo registrado no es un error: no
 * llega nada y no se rompe nada.
 */
export const CANALES = ["email", "push"] as const;

/** Uno de los canales de aviso. */
export type TCanal = typeof CANALES[number];

/**
 * Qué recibe quien no ha tocado nunca la pantalla de preferencias.
 *
 * **Es la única definición de los defectos**, y por eso no hay `DEFAULT` en las columnas de la tabla: una fila
 * solo existe cuando alguien ha elegido, y lo que se aplica mientras no exista se decide aquí. Dos sitios
 * declarando el mismo defecto es un sitio que se queda viejo.
 *
 * Todos nacen con el correo activo porque **es lo que ya pasaba**: los avisos se mandaban por correo
 * sin preguntar, y un defecto apagado no sería una preferencia, sería quitarle un aviso a quien no ha pedido
 * nada. El push nace activo en los que valen para eso y apagado en `anomaly` y `crawl`, que son diarios e informativos
 * — nada de lo que avisa hay que atenderlo en el minuto, así que no merece vibrar un teléfono.
 *
 * `swap` nace con los dos: va dirigido **a una persona concreta** y espera una respuesta, y es justo el aviso
 * que se quedaba una semana sin contestar por no haberse visto.
 *
 * Que el push nazca activo sin que nadie tenga dispositivo registrado **no manda nada a ninguna parte**: es lo
 * que hace que, el día que alguien instale la aplicación y dé permiso, empiece a recibir sin tener que venir
 * aquí a marcar nada.
 */
export const DEFECTOS: Record<TAviso, Record<TCanal, boolean>> = {
    monitor: {email: true, push: true},
    oncall:  {email: true, push: true},
    anomaly: {email: true, push: false},
    crawl:   {email: true, push: false},
    swap:    {email: true, push: true},
};

/**
 * Qué permisos hacen falta para apuntarse a un aviso, o `null` si el aviso no admite suscripción.
 *
 * Cada aviso tiene un destinatario natural —el de monitores va a la guardia y a los suscriptores del servicio,
 * los de guardia, Cloudflare y rastreo solo a la guardia, y el de cambio a quien tiene que responderlo—, y esto
 * dice cuáles admiten además que alguien se apunte, y con qué permiso.
 *
 * **Solo `anomaly` y `crawl` admiten suscripción**, y cada una exige el permiso de la pantalla a la que lleva su
 * correo: `status.infra.cloudflare.view` (`/infra/cloudflare`) y `status.seo.crawler.view` (`/seo/googlebot`).
 * Los otros se quedan fuera por motivos que no son técnicos:
 *
 * - `monitor` ya se puede recibir sin estar de guardia **suscribiéndose a un servicio** desde la portada, que
 *   es más preciso que un «todos los servicios» y ya funciona. Un interruptor global sería un aviso por cada
 *   caída de cualquiera de los veintitantos servicios, o sea el canal que se acaba silenciando entero.
 * - `oncall` dice «hoy **estás** de guardia». Mandárselo a quien no lo está sería mentir; lo que tendría
 *   sentido es otro aviso distinto —«quién está de guardia hoy»—, y ese dato ya está en la cabecera del panel.
 * - `swap` va dirigido a quien tiene que responder una solicitud concreta. Apuntarse a los cambios de guardia
 *   de los demás sería suscribirse a conversaciones ajenas.
 *
 * **El permiso se exige a los suscritos, no a la guardia**: quien está de guardia recibe el aviso por serlo, con
 * o sin permiso. Si debe poder abrir el enlace, el permiso se le asigna aparte.
 *
 * Tiene la misma forma que los requisitos de `cumplePermisos()`: un OR de listas, y cada lista es un AND. Es un
 * `Record` completo a propósito: un aviso nuevo no compila hasta que alguien decide si admite suscripción.
 */
export const PERMISOS_SUSCRIPCION: Readonly<Record<TAviso, EPermission[][] | null>> = {
    monitor: null,
    oncall:  null,
    anomaly: [["status.infra.cloudflare.view"]],
    crawl:   [["status.seo.crawler.view"]],
    swap:    null,
};

/**
 * Qué avisos se pueden recibir **aunque no te toquen**, sin mirar el permiso de nadie: los que tienen
 * `PERMISOS_SUSCRIPCION`. A qué puede apuntarse una persona concreta es esto filtrado por sus permisos.
 *
 * La lista vive aquí porque la miran varios sitios: el endpoint para validar lo que llega, y el emisor para
 * saber a quién sumar.
 */
export const SUSCRIBIBLES: readonly TAviso[] = AVISOS.filter(aviso => PERMISOS_SUSCRIPCION[aviso] !== null);

/** Si un aviso admite que alguien se apunte a recibirlo sin ser destinatario natural. */
export const suscribible = (aviso: TAviso): boolean => SUSCRIBIBLES.includes(aviso);

/**
 * Una casilla de la matriz, tal y como viaja y como se guarda.
 *
 * @property notice  - Qué aviso.
 * @property channel - Por qué canal.
 * @property enabled - Si se manda.
 */
export interface IPreferencia {
    notice: TAviso;
    channel: TCanal;
    enabled: boolean;
}

/**
 * Las preferencias de quien lo pide.
 *
 * Viajan **solo las casillas que existen en la tabla**, no todas: quien no ha guardado nunca recibe una lista
 * vacía, y es la pantalla la que pinta los defectos con `activo()`. Mandarlas todas rellenadas obligaría al
 * servidor a decidir el defecto y a la pantalla a confiar en que lo ha decidido igual.
 *
 * @property preferences - Las casillas guardadas.
 * @property subscribed  - Los avisos a los que se ha apuntado sin ser destinatario natural **y a los que puede
 *                         apuntarse ahora**: una suscripción guardada de quien ya no tiene el permiso sigue en la
 *                         base de datos, dormida, y no se devuelve.
 * @property subscribable - A qué avisos puede apuntarse **ahora** quien pregunta, según sus permisos. Lo decide el
 *                         backend y la pantalla no recalcula nada: los permisos de su sesión pueden ir
 *                         atrasados respecto a una retirada.
 */
export interface IPreferenciasOUT {
    preferences: IPreferencia[];
    subscribed: TAviso[];
    subscribable: TAviso[];
}

/**
 * Guardado de las preferencias **del propio usuario**.
 *
 * Llega la matriz completa y se sustituyen todas, no se parchea una: la pantalla enseña la matriz entera, así
 * que lo que manda al guardar es la matriz entera. El handler valida cada `notice` y cada `channel` contra
 * `AVISOS` y `CANALES` — la tabla admite cualquier cadena, así que sin acotarlo aquí guardaría lo que llegue.
 *
 * @property preferences - La matriz completa.
 * @property subscribed  - Los avisos a los que se apunta. Como la matriz, llega **entero** y sustituye: lo que
 *                         no venga se da de baja.
 */
export interface IPreferenciasIN {
    preferences: IPreferencia[];
    subscribed: TAviso[];
}

/** Si una cadena cualquiera es uno de los avisos del panel. Guarda de tipo para validar en el handler. */
export const avisoValido = (valor: string): valor is TAviso => (AVISOS as readonly string[]).includes(valor);

/** Si una cadena cualquiera es uno de los canales. Guarda de tipo para validar en el handler. */
export const canalValido = (valor: string): valor is TCanal => (CANALES as readonly string[]).includes(valor);

/**
 * Si a alguien le llega un aviso por un canal, aplicando el defecto cuando no ha elegido.
 *
 * **Es el único sitio donde se resuelve la ausencia de fila**, y de ahí que lo usen tanto la pantalla como los
 * emisores: si cada uno interpretara la lista a su manera, la casilla que se ve marcada y el aviso que
 * llega podrían no coincidir, que es la peor forma de fallar de una preferencia — nadie la reporta, porque
 * quien la puso cree que está puesta.
 *
 * @param preferencias Lo que hay guardado, tal cual viene del contrato.
 * @param aviso        Qué aviso.
 * @param canal        Por qué canal.
 */
export const activo = (preferencias: IPreferencia[], aviso: TAviso, canal: TCanal): boolean =>
    preferencias.find(actual => actual.notice === aviso && actual.channel === canal)?.enabled
        ?? DEFECTOS[aviso][canal];

/**
 * Por dónde sale un aviso.
 *
 * @property email - Si se manda por correo.
 * @property push  - Si se manda como notificación.
 */
export interface ICanales {
    email: boolean;
    push: boolean;
}

/**
 * Por dónde le llega **de verdad** un aviso a alguien, que no es lo mismo que lo que tenga marcado.
 *
 * Aquí viven las dos reglas que hacen que un aviso no pueda perderse:
 *
 * 1. **Un aviso no se puede silenciar del todo.** La matriz decide *por dónde* llega, nunca *si* llega: la
 *    pantalla exige al menos un canal por aviso. Se eligió así en lugar de dar un interruptor por aviso porque
 *    cierra el agujero por construcción — con el apagado total, si todos los destinatarios de un aviso lo
 *    apagan, ese aviso no lo recibe nadie y nada lo delata.
 * 2. **El push no cuenta si no hay dispositivo vivo.** Alguien puede dejar el push como único canal y después
 *    desinstalar la aplicación, revocar el permiso o dejar caducar el token. Si eso pasa, el aviso sale por
 *    correo igualmente: un monitor caído que no llega es exactamente lo que no se puede permitir.
 *
 * **La primera regla se comprueba aquí y no solo en la pantalla**, y no es por desconfianza del formulario: en
 * la tabla puede haber filas escritas antes de que la regla existiera, y el endpoint es una API que alguien
 * puede llamar a mano. Si de las dos casillas no sale ninguna, sale el correo — que es el canal que todo el
 * mundo tiene.
 *
 * @param preferencias    Lo que hay guardado, tal cual viene del contrato.
 * @param aviso           Qué aviso.
 * @param conDispositivo  Si esa persona tiene algún dispositivo registrado para notificaciones.
 */
export const canalesEfectivos = (preferencias: IPreferencia[], aviso: TAviso, {conDispositivo}: {conDispositivo: boolean}): ICanales => {
    const email = activo(preferencias, aviso, "email");
    const push = activo(preferencias, aviso, "push") && conDispositivo;

    if (!email && !push) {
        return {email: true, push: false};
    }

    return {email, push};
}

/**
 * Si una matriz cumple la regla de «al menos un canal por aviso», que es lo que valida el endpoint antes de
 * guardar. Devuelve los avisos que se quedan sin ninguno, vacío si está bien — así el error dice cuál falla
 * en vez de un «datos inválidos».
 *
 * **Un aviso que no viene en la matriz no está apagado: está en su defecto**, y por eso esto se mira con
 * `activo()` y no comprobando que exista una fila marcada. Lo contrario parece más estricto y lo que hace es
 * romper por el motivo equivocado: el día que entra un aviso nuevo —`swap` fue el primero—, cualquier pestaña
 * abierta con el panel anterior manda la matriz de antes, sin él, y se llevaba un 422 al guardar por «swap se
 * queda sin canal» cuando lo que pasa es que ese navegador todavía no sabe que existe. Silenciar sigue sin
 * poder hacerse: apagar las dos casillas manda las dos filas a `false` y eso sí se caza.
 *
 * @param preferencias La matriz que se quiere guardar.
 */
export const avisosSinCanal = (preferencias: IPreferencia[]): TAviso[] =>
    AVISOS.filter(aviso => !CANALES.some(canal => activo(preferencias, aviso, canal)));
