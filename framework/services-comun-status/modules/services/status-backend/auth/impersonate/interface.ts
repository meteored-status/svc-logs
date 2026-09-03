/**
 * Editor: Bixus
 * Fecha: Wed, 26 Aug 2026 09:06:22 GMT
 * Hash: dac0f989bd1efb6ad2c2fbcb1393f312
 * Versión: 2026.8.26+2-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

/**
 * Suplantación de usuario en **solo lectura**: ver el panel como lo ve otra persona.
 *
 * Para qué sirve: alguien dice «yo no veo ese servicio» o «a mí no me sale ese menú», y desde
 * `/manager/users` se puede comprobar en lugar de reconstruirlo a mano cruzando roles y permisos.
 *
 * ## El modelo de seguridad, que es lo que hay que leer antes de tocar esto
 *
 * - **Quien suplanta necesita `status.impersonate.view`.** Se comprueba en el servidor, en cada petición, y
 *   nunca se da por bueno lo que diga el cliente: la marca que viaja es una *pretensión*, no una autorización.
 * - **Solo lectura, y se hace cumplir en un solo sitio**: `Auth.authorize()` rechaza cualquier método que no
 *   sea `GET` mientras hay suplantación. Va ahí y no en cada handler porque así lo hereda cualquier endpoint
 *   que se añada después — el día que alguien escriba un `POST` nuevo, ya está cubierto sin acordarse de nada.
 *   Eso incluye el registro de accesos (`/backend/audit/register`, que es un `POST`), y es deliberado: una
 *   suplantación **no puede escribir nada**, ni siquiera en la auditoría, así que no puede dejar apuntes a
 *   nombre de quien no estaba.
 * - **Los permisos que se aplican son los de la persona suplantada**, que es el sentido de la función. La
 *   consecuencia hay que tenerla presente: quien tenga este permiso puede leer todo lo que lea cualquier otra
 *   cuenta, incluidas las de administración. Lo que lo acota es que no puede escribir y que el arranque queda
 *   auditado.
 * - **El arranque y el final se auditan** (`POST /backend/auth/impersonate` y `/impersonate/end`). El del
 *   arranque es fiable: sin él no empieza. El del final es **de mejor esfuerzo**, y hay que leerlo sabiéndolo:
 *   se manda al pulsar «Terminar», así que se pierde si se cierra la pestaña, si se corta la red o si el
 *   navegador muere. **Que no haya apunte de final no significa que la suplantación siga abierta** — significa
 *   que no se cerró pulsando el botón. Para tener esa garantía habría que darle estado en el servidor, y eso
 *   costaría una consulta por petición para saber si la sesión sigue viva.
 *
 *   Lo que acota el hueco sin pagar eso: la marca vive en `sessionStorage`, o sea que muere con la pestaña, y
 *   mientras dura no se puede escribir nada.
 *
 * ## Cómo viaja
 *
 * Del navegador al BFF, en su propia cabecera (`IMPERSONATE_HEADER`). Del BFF al backend, **dentro del valor de
 * `Authorization`**, con el formato que componen y parten las dos funciones de aquí.
 *
 * Eso último es una decisión de fontanería y conviene saber por qué: el cliente del backend construye la
 * configuración de cada petición en el propio método (`{auth: token}`), así que una cabecera nueva habría
 * obligado a tocar los sesenta y pico métodos de los clientes de framework **y** las cuarenta rutas del BFF que
 * los llaman, con un parámetro más que atravesara cada firma. El token es lo único que ya recorre ese camino
 * entero. La seguridad no cambia —el backend valida el permiso y el método en cada petición— y el formato es
 * privado entre dos piezas nuestras: el backend solo lo llama el panel.
 *
 * Se compone y se parte **aquí y en un solo sitio** por lo mismo que `AUDIT_PATH_HEADER`: con el formato escrito
 * en los dos lados, un cambio en uno dejaría al otro sin verlo y la suplantación se ignoraría sin que nada
 * fallase.
 */

/**
 * Cabecera con la que el navegador dice a quién está suplantando. Solo del navegador al BFF: del BFF al backend
 * la marca va dentro de `Authorization` (ver `componerAuth`).
 */
export const IMPERSONATE_HEADER = "x-status-impersonate";

/**
 * Separador de la marca dentro del valor de `Authorization`.
 *
 * El punto y coma es seguro: un *id token* de Firebase es un JWT, o sea tres tramos de base64url separados por
 * puntos, y ninguno de esos alfabetos incluye el punto y coma. Así partir por la primera aparición no puede
 * romper un token válido.
 */
const MARCA = ";impersonate=";

/**
 * Compone el valor de `Authorization` que va del BFF al backend.
 *
 * @param token Token tal y como llegó del navegador.
 * @param user  Id de la persona a suplantar, o `undefined` para no marcar nada.
 */
export const componerAuth = (token: string, user?: number): string => {
    if (user === undefined || !Number.isInteger(user) || user <= 0) {
        return token;
    }

    return `${token}${MARCA}${user}`;
}

/**
 * Parte el valor de `Authorization` en el token y la pretensión de suplantación.
 *
 * Devuelve `impersonate: null` cuando no hay marca **o cuando la que hay no es un id válido**: una marca
 * ilegible se ignora en vez de rechazar la petición, porque lo que pasaría entonces es que alguien vería el
 * panel como él mismo, que es lo seguro. Rechazar la sesión entera por una cabecera mal formada dejaría a la
 * persona fuera del panel sin poder arreglarlo.
 *
 * @param auth Valor de la cabecera.
 */
export const partirAuth = (auth: string): {token: string; impersonate: number|null} => {
    const corte = auth.indexOf(MARCA);
    if (corte < 0) {
        return {token: auth, impersonate: null};
    }

    const id = Number(auth.substring(corte+MARCA.length));

    return {
        token: auth.substring(0, corte),
        impersonate: Number.isInteger(id) && id > 0 ? id : null,
    };
}

/**
 * Empezar a suplantar a alguien.
 *
 * @property user - Id de la persona a suplantar. Tiene que existir, estar activa y no ser uno mismo.
 */
export interface IImpersonateIN {
    user: number;
}

/**
 * Terminar una suplantación, solo para dejar el apunte.
 *
 * Se manda **como uno mismo**, con la marca ya quitada: si fuera con ella puesta la rechazaría el solo lectura,
 * que no distingue —ni tiene que distinguir— un `POST` de negocio de este.
 *
 * A quién se estaba suplantando lo dice el cliente, porque el servidor no lo sabe: no hay estado que consultar.
 * Eso hace que el dato sea tan de fiar como quien lo manda, y es aceptable para lo que es —cerrar el apunte del
 * arranque, que sí es del servidor—. Aun así se valida que sea un usuario que existe, para que un id inventado
 * no acabe escrito en el registro.
 *
 * @property user - Id de la persona a la que se estaba suplantando.
 */
export interface IImpersonateEndIN {
    user: number;
}
