/**
 * Editor: Bixus
 * Fecha: Fri, 21 Aug 2026 06:11:54 GMT
 * Hash: b81d89491b548db6ab331559ceaf397f
 * Versión: 2026.8.21+1-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

/**
 * Acción registrada en la auditoría.
 *
 * - `NAVIGATE` — visita a una página del panel. Es la única que anota el cliente, y por eso la única
 *                que llega por `register`: el endpoint la fija él, no la lee del payload.
 * - `CREATE`   — alta de una entidad del panel.
 * - `EDIT`     — modificación de una entidad del panel.
 * - `DELETE`   — borrado de una entidad del panel.
 * - `CHECK`    — marcado de algo como revisado. Hoy, los logs de error: el botón de la pantalla se llama
 *                «borrar», pero en el índice no se borra nada —se pone `checked` a `true` y dejan de
 *                listarse—, así que va aparte de `DELETE`. No es un matiz: lo marcado sigue estando y se
 *                puede volver a consultar, y llamarlo borrado haría que la auditoría diera por
 *                desaparecidos unos registros que nadie borró. Un apunte no se corrige después.
 *
 * `CREATE` y `EDIT` van separadas aunque el panel las resuelva con el mismo endpoint (`rol/save` y
 * `dpto/save` dan de alta cuando no llega `id`): en una auditoría, crear un rol y retocarle el nombre
 * no son la misma cosa ni de lejos, y distinguirlas es lo que permite filtrar por «qué se ha creado
 * esta semana» sin leerse todos los apuntes.
 *
 * Los valores son cadenas y no números porque este campo se lee tal cual en la pantalla de auditoría y
 * en cualquier consulta que se haga a mano contra Elasticsearch: un `2` obligaría a tener el enum
 * delante para saber qué pasó. El coste en índice es despreciable — son un puñado de valores distintos
 * en un `keyword`, que Elasticsearch guarda una sola vez por segmento.
 *
 * En minúsculas y en inglés, como el resto de los identificadores del monorepo, y **sin tabla de
 * traducción**: el valor es también lo que se enseña. Un mapa de etiquetas obligaría a tocar el frontend
 * cada vez que se añadiera una acción, y hasta que se tocara la nueva no tendría nombre que enseñar.
 */
export enum EAuditAction {
    NAVIGATE = "navigate",
    CREATE   = "create",
    EDIT     = "edit",
    DELETE   = "delete",
    CHECK    = "check",
}

const ACCIONES: Set<string> = new Set<string>(Object.values(EAuditAction));

/**
 * Comprueba que un valor llegado de fuera (query string, documento de Elasticsearch) es una de las
 * acciones conocidas.
 *
 * Hace falta al **leer**, no al escribir: el registro lleva años de retención, así que un día habrá
 * documentos con acciones que esta versión del código ya no declare —o que todavía no declare, si se
 * consulta desde una versión más vieja que la que escribe—. Lo que no case se enseña tal cual en vez
 * de romper la pantalla.
 */
export function isAuditAction(action: unknown): action is EAuditAction {
    return typeof action === "string" && ACCIONES.has(action);
}

/**
 * Valor que puede tomar una clave del detalle.
 *
 * La lista es corta a propósito: el detalle se pinta en una celda de tabla, así que tiene que poder
 * convertirse en una línea de texto sin decidir nada. Nada de objetos anidados — el día que un detalle
 * necesite estructura, es que ese dato quiere su propio campo.
 */
export type TAuditDetailValue = string|number|boolean|string[];

/**
 * Detalle de la acción: qué se tocó, más allá de la ruta.
 *
 * Es un mapa abierto y no una interfaz por acción porque cada acción describe algo distinto y no hay
 * nada que compartan: forzar un tipo común acabaría en un objeto con todos los campos opcionales, que
 * no dice más que esto y encima parece que promete.
 *
 * Claves y valores van **en inglés y en minúsculas**, igual que las acciones, y nunca pasan por i18n:
 * esto es un dato almacenado, no texto de interfaz. Un detalle que se tradujera haría que el mismo
 * apunte dijera cosas distintas según el idioma en que tuviera puesto el panel quien lo consultase, y
 * que dejara de coincidir con lo que hay guardado en Elasticsearch. Por lo mismo se enseñan tal cual, sin
 * tabla de etiquetas en el frontend.
 *
 * En Elasticsearch va como `flattened`: así las claves no crean campos en el mapeo —con un año de
 * retención, un mapeo que crece con cada acción nueva acaba siendo un problema— pero siguen siendo
 * consultables sin reindexar. Es lo que lo diferencia del `headers` de `mr-status-component`, que va
 * como `object` deshabilitado: ahí las claves las pone un tercero y son ilimitadas; aquí las pone este
 * código y son un puñado.
 */
export type TAuditDetail = Record<string, TAuditDetailValue>;

/**
 * Cabecera con la que el panel dice **en qué pantalla suya** estaba el usuario al lanzar la petición.
 *
 * Existe porque en un apunte de auditoría la ruta que interesa es la del panel (`/manager/users`), no el
 * endpoint que la resolvió (`/backend/user/delete`): el primero es donde estaba la persona y es lo que
 * se reconoce al leer el registro; el segundo es un detalle de implementación que además cambia si
 * mañana se renombra la API.
 *
 * Va en una cabecera y no en el cuerpo de cada petición a propósito: es un dato transversal, y metido en
 * los `ISaveIN`/`IDeleteIN` obligaría a que seis contratos de negocio declararan un campo que no tiene
 * nada que ver con lo que hacen.
 *
 * **Es un dato que da el cliente, así que no es de fiar** — igual que la ruta de un `navigate`. Lo que
 * sigue siendo del backend es lo que importa: *qué* se hizo, *quién* lo hizo y *cuándo*. Esto solo dice
 * desde dónde, y el peor caso es un apunte que señala una pantalla equivocada, no uno inventado. Si la
 * cabecera no llega —una versión vieja del panel, o alguien llamando a la API a pelo— se cae al endpoint,
 * que para una llamada que no viene del panel es además la respuesta correcta: no hubo pantalla.
 */
export const AUDIT_PATH_HEADER = "x-audit-path";
