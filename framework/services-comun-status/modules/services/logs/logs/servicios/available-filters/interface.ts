/**
 * Editor: Bixus
 * Fecha: Mon, 14 Sep 2026 07:03:21 GMT
 * Hash: f3cd50c05c7fcf219c62fe8d1a5b5514
 * Versión: 2026.9.14+4-bixus
 * Anterior: 2026.9.14+1-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

export interface IAvaliableFiltersIN {
    projects: string;
}

/**
 * @property projects - Proyectos que **puede ver** quien pregunta, no los que ha elegido. Los resuelve el
 *                      backend con los departamentos de la sesión, igual que el listado: es su permiso, no
 *                      una preferencia. Están para poder ofrecerlos como filtro; elegir un subconjunto no
 *                      amplía lo que se ve, solo lo acota.
 * @property entornos - Entornos que **tienen registros** en esos proyectos (`EEntorno` de `@mr/core-log`).
 *                      Salen de una agregación, no de la lista de los tres posibles: ofrecer un botón de
 *                      «Test» donde nunca ha escrito nadie es ofrecer una tabla vacía. Ordenados.
 * @property services - Servicios que aparecen en los logs de esos proyectos.
 * @property types    - Tipos que aparecen en los logs de esos proyectos.
 * @property regions  - Zonas de despliegue que aparecen en ellos. Salen de una agregación, así que los logs
 *                      que no traen el campo —los de emisores anteriores a `@mr/core-log`— no aportan
 *                      ninguna opción: no se sabe de dónde salieron, y no hay valor que ofrecer.
 * @property hosts    - Máquinas o pods que aparecen en ellos. Es el de **más cardinalidad** de todos —un
 *                      valor por pod, y los pods se reemplazan en cada despliegue—, así que es el primero
 *                      que se va a comer el tope de `FILTER_VALUES_MAX`.
 */
export interface IAvaliableFiltersOUT {
    projects: string[];
    entornos: number[];
    services: string[];
    types: string[];
    regions: string[];
    hosts: string[];
}
