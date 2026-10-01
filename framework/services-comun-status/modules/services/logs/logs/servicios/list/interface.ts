/**
 * Editor: Bixus
 * Fecha: Wed, 23 Sep 2026 08:46:25 GMT
 * Hash: c5bb00f2a73f68d6e8394ddc24b8ec71
 * Versión: 2026.9.23+1-bixus
 * Anterior: 2026.9.14+3-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

import type {ESeverity} from "../../interface";
import {type IHistogram} from "../../interface";

export interface IListIN {
    projects: string;
    page?: string;
    perPage?: string;
    severity?: string;
    services?: string;
    types?: string;
    ts_from?: string;
    ts_to?: string;
}

/**
 * Página de logs de servicio.
 *
 * @property logs      - Registros de la página pedida, del más reciente al más antiguo.
 * @property total     - Registros que cumplen los filtros, no los de esta página. Es lo que necesita el
 *                       rótulo del paginador para decir de cuántos se está viendo un trozo.
 * @property reachable - De esos, cuántos se pueden llegar a servir pasando páginas: el listado pagina con
 *                       `from`/`size`, así que no pasa de `MAX_RESULT_WINDOW`.
 *
 *                       Va aparte de `total` porque el paginador necesita este y el rótulo el otro: con
 *                       `total` se ofrecerían páginas que el servicio no puede servir, y recortando
 *                       `total` no se vería cuántos registros quedan fuera de alcance. Cuando
 *                       `reachable < total`, hay que acotar más el filtro para llegar al resto.
 * @property histogram - Cómo se reparten en el tiempo los registros que cumplen los filtros, para la
 *                       gráfica. **No** depende de la página, y tampoco le afecta el techo de
 *                       `reachable`: una agregación cuenta sobre todo lo que casa. Es la única parte de
 *                       la respuesta que sigue siendo cierta más allá de donde llega el paginador.
 */
export interface IListOUT {
    logs: ILog[];
    total: number;
    reachable: number;
    histogram: IHistogram;
}

/**
 * Un registro del listado.
 *
 * @property region - Zona del despliegue desde la que se escribió. **Opcional, y hay que tratarlo como
 *                    tal**: el campo se añadió al índice el 2026-09-14 y solo lo mandan los emisores que
 *                    usan `@mr/core-log`, así que los logs de antes no lo traen — y quien loguea desde un
 *                    navegador no tiene ninguna. Un log sin región no es un log de ningún sitio, es uno del
 *                    que no se sabe.
 * @property host   - Máquina o pod que lo escribió. Es lo que separa dos réplicas del mismo servicio
 *                    cuando solo una falla. Opcional por lo mismo que `region`.
 */
export interface ILog {
    timestamp: number;
    project: string;
    service: string;
    region?: string;
    host?: string;
    type: string;
    severity: ESeverity;
    message: string;
}
