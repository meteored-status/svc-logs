/**
 * Editor: Bixus
 * Fecha: Thu, 20 Aug 2026 06:26:03 GMT
 * Hash: f71aa236a0684fc9aa7e3c716c8d41d3
 * Versión: 2026.8.20+1-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

/**
 * Filtros y paginación del listado de auditoría, tal y como llegan en la query string.
 *
 * Todo son cadenas porque es lo que hay en una query string: el handler las convierte y descarta lo que
 * no cuadre en vez de responder un error, igual que hace el listado de logs. Un filtro ilegible es un
 * filtro que no se aplica, no una petición inválida.
 *
 * @property user    - Texto a buscar en el usuario: casa por **nombre o email**, en cualquier parte del
 *                     valor y sin distinguir mayúsculas. Es el mismo criterio que el filtro de miembros
 *                     de la tabla de departamentos.
 * @property path    - Texto a buscar en la ruta, también en cualquier parte y sin distinguir mayúsculas:
 *                     `manager` encuentra `/manager/users` y `/manager/rol`.
 * @property tsFrom  - Límite inferior del `@timestamp`, en milisegundos e **incluido**.
 * @property tsTo    - Límite superior del `@timestamp`, en milisegundos e **incluido**.
 * @property page    - Página a devolver, empezando en 1. Ausente o ilegible es la primera.
 * @property perPage - Registros por página. Ausente es `PER_PAGE_DEFAULT`, y por encima de
 *                     `PER_PAGE_MAX` se recorta a ese máximo.
 */
export interface IListIN {
    user?: string;
    path?: string;
    ts_from?: string;
    ts_to?: string;
    page?: string;
    perPage?: string;
}

/**
 * Página del registro de auditoría.
 *
 * @property accesses - Accesos de la página pedida, **del más reciente al más antiguo**. La ordenación
 *                      la impone el endpoint y no el cliente: es la única que tiene sentido en un
 *                      registro de auditoría, y así el `search_after` de Elastic no depende de lo que
 *                      pida quien consulta.
 * @property total    - Accesos que cumplen los filtros, no los de esta página. Es lo que necesita el
 *                      paginador para saber cuántas páginas hay.
 *
 *                      Ojo: Elasticsearch cuenta hasta 10.000 por defecto, así que el endpoint pide el
 *                      total exacto (`track_total_hits`). Con retención de un año el índice no llega a
 *                      un tamaño donde eso pese.
 * @property reachable - De esos, cuántos se pueden llegar a servir pasando páginas. El listado se pagina
 *                      con `from`/`size`, así que no puede pasar de la ventana de resultados de
 *                      Elasticsearch (`index.max_result_window`, 10.000 por defecto).
 *
 *                      Va aparte de `total` porque el paginador necesita este y el rótulo necesita el
 *                      otro: con `total` en el paginador se ofrecerían páginas que el backend no puede
 *                      servir, y recortando `total` no se vería cuántos accesos quedan fuera del
 *                      alcance. Cuando `reachable < total`, hay que acotar más el filtro —por fecha,
 *                      usuario o ruta— para llegar al resto.
 * @property page      - Página devuelta, ya normalizada (la que se pidió, o 1 si no era válida).
 * @property perPage   - Registros por página aplicados, ya normalizados y recortados al máximo.
 * @property histogram - Cómo se reparten en el tiempo los accesos que cumplen los filtros, para la
 *                       gráfica que va encima de la tabla.
 *
 *                       No depende de la página: cuenta **todos** los que casan, así que tampoco le
 *                       afecta el techo de `reachable`. Es la única parte de esta respuesta que dice la
 *                       verdad completa cuando el filtro trae más accesos de los que se pueden
 *                       recorrer.
 */
export interface IListOUT {
    accesses: IAccess[];
    total: number;
    reachable: number;
    page: number;
    perPage: number;
    histogram: IHistogram;
}

/**
 * Distribución de los accesos en el tiempo.
 *
 * @property interval - Anchura de cada tramo, tal y como la eligió Elasticsearch (`1h`, `7d`...). La
 *                      elige él y no el cliente para que caiga siempre en horas o días enteros, que es
 *                      lo que se sabe leer en un eje.
 * @property buckets  - Tramos, del más antiguo al más reciente. Van **todos**, incluidos los vacíos: un
 *                      hueco es información —ahí nadie entró— y saltárselo dibujaría una gráfica que
 *                      miente sobre el reparto en el tiempo.
 */
export interface IHistogram {
    interval: string;
    buckets: IBucket[];
}

/**
 * Tramo de la distribución.
 *
 * @property timestamp - Instante en que empieza el tramo, en milisegundos.
 * @property count     - Accesos registrados dentro del tramo.
 */
export interface IBucket {
    timestamp: number;
    count: number;
}

/**
 * Acceso registrado.
 *
 * El usuario viaja con nombre y email **copiados del momento del acceso**, no resueltos al consultar:
 * es un registro histórico, así que tiene que seguir diciendo quién entró aunque después se le cambie
 * el nombre o se borre la cuenta. Por eso tampoco se hace un join con la tabla de usuarios al leer.
 *
 * @property timestamp - Instante del acceso, en milisegundos.
 * @property user      - Quién accedió, tal y como estaba registrado entonces.
 * @property path      - Ruta visitada, con su query string si la tenía.
 */
export interface IAccess {
    timestamp: number;
    user: IAccessUser;
    path: string;
}

/**
 * Usuario de un acceso registrado.
 *
 * @property id    - Identificador interno del usuario. Puede apuntar a una cuenta que ya no exista.
 * @property name  - Nombre que tenía al acceder.
 * @property email - Email que tenía al acceder.
 */
export interface IAccessUser {
    id: number;
    name: string;
    email: string;
}

/**
 * Registros por página cuando el cliente no pide un tamaño concreto.
 */
export const PER_PAGE_DEFAULT = 50;

/**
 * Techo de registros por página. Está para que una petición no se lleve el índice entero de una vez;
 * pedir más no falla, se recorta a este valor.
 */
export const PER_PAGE_MAX = 200;
