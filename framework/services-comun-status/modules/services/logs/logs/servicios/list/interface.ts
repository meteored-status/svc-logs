import {ESeverity, type IHistogram} from "../../interface";

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

export interface ILog {
    timestamp: number;
    project: string;
    service: string;
    type: string;
    severity: ESeverity;
    message: string;
}
