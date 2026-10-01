/**
 * Editor: Bixus
 * Fecha: Tue, 15 Sep 2026 08:43:57 GMT
 * Hash: 8eeaf792fee26681c753e0ac672d53e6
 * Versión: 2026.9.15+1-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

/**
 * Lo que se cambia de un proyecto del catálogo: a qué grupos se reparte y las excepciones de sus servicios.
 *
 * **Una petición toca un proyecto**, y no el catálogo entero. Dos personas repartiendo proyectos distintos
 * a la vez no se pisan, y una petición que falla a medias deja sin tocar todo lo demás.
 *
 * @property id       - Fila del catálogo a modificar (`ICatalogProject.id`). El proyecto y su tipo de
 *                      registro no se mandan: no se pueden cambiar —los pone la ingesta al descubrirlos— y
 *                      aceptarlos aquí solo abriría la puerta a mover un reparto al registro de al lado.
 * @property groups   - Grupos que ven el proyecto. **La lista llega completa y sustituye**: lo que no venga
 *                      se quita. Vacía es un valor legítimo y significa que no lo ve nadie; **ausente no es
 *                      lo mismo** —deja el reparto del proyecto como está—, y esa distinción es lo que
 *                      permite que la pantalla de servicios guarde una excepción sin reescribir de paso los
 *                      grupos del proyecto que leyó hace un rato. Mismo criterio que el `users` de
 *                      `/backend/dpto/save`.
 * @property services - Excepciones a cambiar. **Solo las que cambian**, al contrario que `groups`, y esa
 *                      diferencia es a propósito: la lista de servicios la alarga la ingesta por su cuenta,
 *                      así que una petición que la mandara entera estaría siempre escribiendo un estado que
 *                      pudo quedarse viejo entre que se pintó la pantalla y se pulsó guardar. Ausente no
 *                      toca ninguna.
 */
export interface ISaveIN {
    id: number;
    groups?: number[];
    services?: ISaveServiceIN[];
}

/**
 * La excepción de un servicio.
 *
 * @property id         - Fila del servicio (`ICatalogService.id`). Se comprueba en el servidor que sea del
 *                        proyecto que se está guardando: sin eso, un `id` de otro proyecto repartiría un
 *                        servicio ajeno con el permiso de este.
 * @property overridden - Si tiene excepción. A `false` vuelve a heredar y **se borran sus grupos**, vengan
 *                        o no en `groups`.
 * @property groups     - Grupos de la excepción, completa y sustituyendo. Vacía con `overridden` a `true`
 *                        es lo que esconde un servicio de todo el mundo sin tocar el resto del proyecto.
 */
export interface ISaveServiceIN {
    id: number;
    overridden: boolean;
    groups: number[];
}
