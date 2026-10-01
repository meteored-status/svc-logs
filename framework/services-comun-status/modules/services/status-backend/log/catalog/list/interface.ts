/**
 * Editor: Bixus
 * Fecha: Tue, 15 Sep 2026 08:43:57 GMT
 * Hash: 93f5b147febcd7086df36bf368053d8d
 * Versión: 2026.9.15+1-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

/**
 * El catálogo entero de proyectos y servicios de los logs, con a qué grupos se reparte cada cosa.
 *
 * **Viaja completo y de una vez**, sin paginar y sin pedir los servicios de un proyecto aparte. Es lo que
 * emite el despliegue —decenas de proyectos, no miles—, y una pantalla cuyo trabajo es comparar unas filas
 * con otras («¿por qué este servicio no lo ve nadie?») con la mitad de los datos sin cargar no responde a
 * esa pregunta. Si algún día creciera, lo que hay que partir es la pantalla, no esta respuesta.
 *
 * @property projects        - Los proyectos, ordenados por nombre.
 * @property availableGroups - Catálogo de grupos a los que se puede repartir, para ofrecerlos sin una
 *                             segunda petición. **No lleva miembros**: aquí se elige a qué grupo va un
 *                             proyecto, y quién está dentro de cada grupo es la pantalla de grupos.
 */
export interface IListOUT {
    projects: ICatalogProject[];
    availableGroups: ICatalogGroup[];
}

/**
 * Un proyecto del catálogo.
 *
 * **Uno por nombre, no uno por registro**: `tiempo` es una sola entrada aunque escriba logs de servicio y de
 * error, y quien lo tiene ve las dos cosas. Lo estuvo partido en dos y se unificó en `ddl-alter-0046.sql` —
 * el tipo de registro vive en el servicio, que es donde significa algo.
 *
 * @property id        - Identificador de la fila del catálogo (`log_project.id`), que es lo que se manda al
 *                       guardar.
 * @property project   - El proyecto tal y como viene en los documentos indexados.
 * @property groups    - Grupos que ven este proyecto. Vacío significa que **no lo ve nadie**, que es como
 *                       nace todo lo que descubre la ingesta.
 * @property services  - Servicios vistos dentro del proyecto, ordenados por nombre. Los que no tienen
 *                       excepción heredan estos `groups`.
 * @property firstSeen - Primer log recibido del proyecto, en milisegundos.
 * @property lastSeen  - Último log recibido, en milisegundos. Lo refresca la ingesta de tanto en tanto, no
 *                       en cada documento, así que es aproximado a propósito: sirve para distinguir lo vivo
 *                       de lo que dejó de emitir hace meses, no para saber la hora exacta del último log.
 */
export interface ICatalogProject {
    id: number;
    project: string;
    groups: number[];
    services: ICatalogService[];
    firstSeen: number;
    lastSeen: number;
}

/**
 * Un servicio visto dentro de un proyecto.
 *
 * **Uno por nombre**, escriba en uno de los dos registros o en los dos: el mismo servicio deja apuntados sus
 * pasos y sus errores, y es un servicio, no dos (`ddl-alter-0047.sql`). Lo que se pierde con eso es poder
 * apartarle solo uno de los dos registros; lo que se usa —apartarlo entero de su proyecto— sigue estando.
 *
 * @property id         - Identificador de la fila (`log_project_service.id`), que es lo que se manda al
 *                        guardar su excepción.
 * @property service    - El `servicio` del documento, tal cual: `{namespace}/{nombre}` cuando lo escribe
 *                        `@mr/core-log`, y lo que mande el emisor cuando no.
 * @property overridden - Si tiene excepción. A `false` hereda los grupos del proyecto y `groups` viene
 *                        vacío; a `true` sus grupos son **exactamente** `groups`, que puede no tener
 *                        ninguno — y entonces no lo ve nadie aunque el proyecto sí se vea.
 * @property groups     - Grupos de la excepción. Solo significa algo con `overridden` a `true`.
 * @property firstSeen  - Primer log recibido del servicio, en milisegundos.
 * @property lastSeen   - Último log recibido, en milisegundos. Aproximado, igual que el del proyecto.
 */
export interface ICatalogService {
    id: number;
    service: string;
    overridden: boolean;
    groups: number[];
    firstSeen: number;
    lastSeen: number;
}

/**
 * Un grupo al que se puede repartir.
 *
 * @property id   - Identificador del grupo.
 * @property name - Nombre visible.
 */
export interface ICatalogGroup {
    id: number;
    name: string;
}
