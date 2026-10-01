/**
 * Editor: Bixus
 * Fecha: Fri, 18 Sep 2026 09:12:41 GMT
 * Hash: ae0e7d3c365d2064ad6814df03a39f18
 * Versión: 2026.9.18+1-bixus
 * Anterior: 2026.9.9+1-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

/**
 * Un proyecto o subproyecto del catálogo.
 *
 * @property proyecto    - Clave técnica del proyecto, tal cual llega en los logs (`tiempo`, `mr`).
 * @property subproyecto - Clave técnica del subproyecto. **Ausente** cuando el proyecto no se subdivide, que no
 *                         es lo mismo que venir vacío.
 * @property nombre      - Cómo se enseña. **Siempre viene con algo**: cuando nadie le ha puesto nombre, cae a la
 *                         clave técnica (`tiempo/es`). El respaldo lo resuelve el backend y no la pantalla, para
 *                         que el próximo consumidor no tenga que acordarse de hacerlo.
 * @property enabled     - Si sale en el desplegable del panel de URLs. A `false` **no pierde el histórico**: sus
 *                         visitas siguen guardadas y su nombre sigue puesto, solo deja de ofrecerse.
 * @property orden       - Con qué prioridad se lista. Menor va antes.
 */
export interface ISeoProjectOUT {
    proyecto: string;
    subproyecto?: string;
    nombre: string;
    enabled: boolean;
    orden: number;
}

/**
 * El catálogo de proyectos.
 *
 * Sale de MySQL y no del agregado, que es el motivo de que exista la tabla: inferir la lista con un
 * `GROUP BY` sobre `logs.accesos_uri` costaba 154 MiB de BigQuery **en cada carga** de la pantalla, y daba una
 * lista que no se puede ordenar ni renombrar porque no la decide nadie.
 *
 * @property projects - Todos, habilitados primero y luego por orden. Incluye los deshabilitados: quien los
 *                      quiera fuera —el desplegable del panel— los filtra, y la pantalla de gestión los necesita
 *                      para poder volver a activarlos.
 */
export interface ISeoProjectsOUT {
    projects: ISeoProjectOUT[];
}

/**
 * Un proyecto que está en los logs y no en el catálogo.
 *
 * **Dos fuentes, y no se mezclan.** `dias`/`visitas` vienen de `accesos_uri` (tráfico humano, filtrado a
 * `200`/`304`) y `diasRastreo`/`rastreo` de `accesos_crawler_resumen` (peticiones de Googlebot, sin filtrar por
 * estado). No son la misma magnitud —una compara visitas útiles, la otra rastreo total, 404 y 410 incluidos—
 * así que se informan **por separado** y nunca se suman. Un proyecto que solo tenga rastreo llega con
 * `dias: 0` y `visitas: 0`, que es justo el caso que antes no se veía: hasta que solo se miraba `accesos_uri`,
 * un proyecto sin tráfico humano no salía en ningún sitio aunque Googlebot llevara meses pidiéndolo.
 *
 * @property proyecto    - Clave técnica del proyecto.
 * @property subproyecto - Clave técnica del subproyecto, ausente si no tiene.
 * @property dias        - En cuántos días de la ventana consultada hay visitas humanas. Distingue un proyecto
 *                         que empezó a emitir de uno que apareció un día por un error de etiquetado.
 * @property visitas     - Visitas humanas en esa ventana, para poder decidir si merece registrarse.
 * @property diasRastreo - En cuántos días de la ventana consultada rastreó Googlebot.
 * @property rastreo     - Peticiones de Googlebot en esa ventana. No son visitas: cuentan cualquier estado,
 *                         404 y 410 incluidos.
 */
export interface ISeoDescubiertoOUT {
    proyecto: string;
    subproyecto?: string;
    dias: number;
    visitas: number;
    diasRastreo: number;
    rastreo: number;
}

/**
 * Lo que hay en los logs y no está registrado.
 *
 * **Es lo que evita que el catálogo se convierta en un agujero.** Con una lista mantenida a mano, un proyecto
 * nuevo en la CDN que nadie registre desaparecería del panel sin dar la cara; aquí sale esperando a que se le dé
 * un nombre. Se pide **a mano** y no al abrir la pantalla porque es la única consulta a BigQuery que queda en
 * esta sección, y cuesta.
 *
 * @property found - Los no registrados, de más visitas humanas a menos y, a igualdad de visitas, de más
 *                   rastreo a menos.
 * @property from  - Primer día de la ventana en la que se ha buscado, `YYYY-MM-DD`.
 * @property to    - Último día.
 */
export interface ISeoDescubrirOUT {
    found: ISeoDescubiertoOUT[];
    from: string;
    to: string;
}

/**
 * Crea o actualiza una entrada del catálogo.
 *
 * **Los campos que no vengan no se tocan.** Es lo que permite guardar solo el nombre sin tener que devolver el
 * orden y el `enabled` que no se han editado — y lo que evita que dos pestañas abiertas se pisen los campos que
 * la otra sí cambió.
 *
 * @property proyecto    - Clave técnica del proyecto. Junto con el subproyecto es la clave: no se puede renombrar,
 *                         se borra y se crea.
 * @property subproyecto - Clave técnica del subproyecto, ausente si no tiene.
 * @property nombre      - Cómo se enseña. La cadena vacía **quita** el nombre y deja que se enseñe la clave
 *                         técnica, que es distinto de no mandar el campo.
 * @property enabled     - Si sale en el desplegable.
 * @property orden       - Menor va antes.
 */
export interface ISeoProjectSaveIN {
    proyecto: string;
    subproyecto?: string;
    nombre?: string;
    enabled?: boolean;
    orden?: number;
}

/**
 * Borra una entrada del catálogo.
 *
 * **Para retirar un proyecto está `enabled`, no esto.** Borrar existe para deshacer un alta equivocada —algo que
 * se descubrió, se registró y resultó ser un dominio de pruebas—: lo que tiene histórico sigue teniendo sus
 * visitas en BigQuery y sin su fila pierde el nombre con el que se enseñaba.
 *
 * @property proyecto    - Clave técnica del proyecto.
 * @property subproyecto - Clave técnica del subproyecto, ausente si no tiene.
 */
export interface ISeoProjectDeleteIN {
    proyecto: string;
    subproyecto?: string;
}
