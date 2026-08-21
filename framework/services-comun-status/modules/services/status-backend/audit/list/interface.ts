/**
 * Editor: Bixus
 * Fecha: Fri, 21 Aug 2026 06:11:54 GMT
 * Hash: 55b52a2ddada97e52297d70244860e6e
 * Versión: 2026.8.21+1-bixus
 * Anterior: 2026.8.20+1-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

import type {EAuditAction, TAuditDetail} from "../interface";

/**
 * Filtros y paginación del listado de auditoría, tal y como llegan en la query string.
 *
 * Todo son cadenas porque es lo que hay en una query string: el handler las convierte y descarta lo que
 * no cuadre en vez de responder un error, igual que hace el listado de logs. Un filtro ilegible es un
 * filtro que no se aplica, no una petición inválida.
 *
 * @property user    - Emails de los usuarios a incluir, separados por `;`. Son valores **exactos**: se
 *                     eligen de la lista que da `available-filters`, no se escriben. Vale cualquiera de
 *                     ellos.
 *
 *                     Se filtra por email y no por nombre porque es lo único único por usuario; la
 *                     pantalla enseña el nombre al lado, pero manda esto.
 * @property path    - Rutas a incluir, separadas por `;`, con el mismo criterio. Ojo: al ser exactas,
 *                     filtrar por `/logs` ya **no** arrastra `/logs-error`, como pasaba cuando se
 *                     buscaba por subcadena.
 * @property action  - Acciones a incluir (`EAuditAction`), separadas por `;`, con el mismo criterio.
 *                     Lo que no sea una acción conocida se ignora en vez de devolver una lista vacía:
 *                     filtrar por algo que no existe no es una petición inválida, es un filtro que no
 *                     dice nada.
 * @property tsFrom  - Límite inferior del `@timestamp`, en milisegundos e **incluido**.
 * @property tsTo    - Límite superior del `@timestamp`, en milisegundos e **incluido**.
 * @property page    - Página a devolver, empezando en 1. Ausente o ilegible es la primera.
 * @property perPage - Registros por página. Ausente es `PER_PAGE_DEFAULT`, y por encima de
 *                     `PER_PAGE_MAX` se recorta a ese máximo.
 */
export interface IListIN {
    user?: string;
    path?: string;
    action?: string;
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
 * @property userCount - Usuarios **distintos** entre los accesos que cumplen los filtros. No se puede
 *                       derivar de `accesses`: ahí solo hay una página.
 * @property topPath   - La ruta más visitada, o ausente si no hay ningún acceso. Igual que `userCount`,
 *                       se cuenta sobre todo lo que casa con el filtro, no sobre la página.
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
    userCount: number;
    topPath?: ITopPath;
    page: number;
    perPage: number;
    histogram: IHistogram;
}

/**
 * Ruta más visitada de las que cumplen los filtros.
 *
 * @property path  - La ruta.
 * @property count - Cuántos accesos suyos hay.
 */
export interface ITopPath {
    path: string;
    count: number;
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
 * @property path      - Pantalla del panel donde se produjo la acción (`/manager/users`), con su query
 *                       string si la tenía. Es la del panel también en las modificaciones —no el
 *                       endpoint que las ejecutó—, porque es donde estaba la persona y es lo que se
 *                       reconoce al leer el registro. Solo cae al endpoint si la petición no dijo desde
 *                       qué pantalla venía, que es el caso de una llamada a la API a pelo.
 * @property action    - Qué se hizo. Los accesos registrados antes de que existiera este campo llegan
 *                       como `navigate`, que es lo que eran: entonces solo se anotaban visitas.
 * @property detail    - Detalle de la acción, o ausente si no lo tiene. Un `navigate` nunca lo lleva: la
 *                       ruta ya lo dice todo.
 */
export interface IAccess {
    timestamp: number;
    user: IAccessUser;
    path: string;
    action: EAuditAction;
    detail?: TAuditDetail;
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
