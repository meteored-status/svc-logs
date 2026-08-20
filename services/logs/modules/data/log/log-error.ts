import elastic, {
    AggregationsAggregate,
    AggregationsStringTermsAggregate,
    AggregationsStringTermsBucket,
    QueryDslQueryContainer
} from "services-comun/modules/utiles/elastic";
import {Error, type ILogErrorES} from "logs-services/modules/data/error";
import {MAX_RESULT_WINDOW, PER_PAGE_MAX, type IHistogram} from "services-comun-status/modules/services/logs/logs/interface";

interface SearchFilter {
    projects: string[];
    servicio?: string[];
    url?: string[];
    linea?: number[];
    archivo?: string[];
    ts_from?: number;
    ts_to?: number;
}

interface SearchPagination {
    page?: number;
    perPage?: number;
}

interface IFilterValues {
    servicio: string[];
    archivo: string[];
    linea: number[];
    url: string[];
}

type Agregador = AggregationsStringTermsAggregate;
type ESAggregator = {
    'by-servicio': Agregador;
    'by-archivo': Agregador;
    'by-linea': Agregador;
    'by-url': Agregador;
}

interface IDelete {
    proyecto: string;
    ts?: number;
    servicio?: string;
    archivo?: string;
    linea?: number;
    url?: string;
}

/**
 * Página de resultados: los registros pedidos, cuántos hay en total y cómo se reparten en el tiempo.
 *
 * Las tres cosas salen de **una sola** consulta a Elasticsearch. El total va con `track_total_hits`
 * —sin él, Elasticsearch deja de contar en 10.000 y el paginador no sabría cuántas páginas hay— y el
 * reparto es una agregación, así que ninguno obliga a traerse más documentos de los de la página.
 *
 * @property logs      - Registros de la página.
 * @property total     - Registros que cumplen el filtro, contados sin tope.
 * @property reachable - De esos, cuántos se pueden alcanzar pasando páginas con el `perPage` de esta
 *                       petición. Se calcula contra la última página **completa** y no contra los 10.000
 *                       pelados: con 30 por página, la última acaba en el 9.990, y redondear al alza
 *                       ofrecería al paginador una página que no existe.
 * @property histogram - Reparto en el tiempo, para la gráfica.
 */
export interface ISearchResult {
    logs: Error[];
    total: number;
    reachable: number;
    histogram: IHistogram;
}

/**
 * Nombre de la agregación del reparto, en la consulta y en la respuesta.
 */
const AGG_DISTRIBUCION = "distribucion";

/**
 * Tramos que se piden para la gráfica.
 *
 * Es un **máximo aproximado**: con `auto_date_histogram`, Elasticsearch elige una anchura redondeada
 * —una hora, un día, una semana— y devuelve los tramos que salgan, nunca más de estos. Se hace así y no
 * calculando la anchura aquí porque el rango depende de lo que haya filtrado quien pregunta, y una
 * anchura fija daría tramos absurdos en los extremos.
 */
const HISTOGRAM_BUCKETS = 32;

/**
 * La agregación del reparto, tal y como la devuelve Elasticsearch.
 *
 * Se declara a mano porque `AggregationsAggregate` es la unión de todas las formas de agregación
 * posibles y no dice cuál es esta.
 */
interface IDistribucionES {
    interval: string;
    buckets: {
        key: number;
        doc_count: number;
    }[];
}

/**
 * Convierte la agregación del reparto en lo que se publica. El `as` vive solo aquí y no repartido por
 * cada uso.
 */
const distribucion = (agg?: AggregationsAggregate): IHistogram => {
    if (agg === undefined) {
        return {interval: "", buckets: []};
    }

    const {interval, buckets} = agg as IDistribucionES;

    return {
        interval: interval ?? "",
        buckets: (buckets ?? []).map(bucket => ({
            timestamp: bucket.key,
            count: bucket.doc_count,
        })),
    };
}

export class LogError {
    /* STATIC */
    /**
     * Busca logs de errores aplicando filtros y paginación.
     * @param filter Filtros a aplicar
     * @param pagination Paginación a aplicar
     */
    public static async search(filter: SearchFilter, {page: pagePedida = 1, perPage: perPagePedida = 15}: SearchPagination): Promise<ISearchResult> {
        // El tamaño por defecto sigue siendo 15, el de siempre, para no cambiarle la respuesta a quien no
        // pide `perPage`. Lo que se añade es el techo, y el recorte de la página a la última alcanzable:
        // pedir más allá de la ventana de resultados devolvía un vacío indistinguible de «no hay nada».
        const perPage = Math.min(Math.max(perPagePedida, 1), PER_PAGE_MAX);
        const maxPage = Math.max(Math.floor(MAX_RESULT_WINDOW/perPage), 1);
        const page = Math.min(Math.max(pagePedida, 1), maxPage);

        const {projects} = filter;

        const must: QueryDslQueryContainer[] = [
            {
                terms: {
                    proyecto: projects
                }
            },
            {
                term: {
                    checked: false
                }
            }
        ];

        if (filter.servicio) {
            must.push({
                terms: {
                    servicio: filter.servicio
                }
            });
        }

        if (filter.url) {
            must.push({
                terms: {
                    url: filter.url
                }
            });
        }

        if (filter.linea) {
            must.push({
                terms: {
                    linea: filter.linea
                }
            });
        }

        if (filter.archivo) {
            must.push({
                terms: {
                    archivo: filter.archivo
                }
            });
        }

        if (filter.ts_from || filter.ts_to) {
            must.push({
                range: {
                    "@timestamp": {
                        gte: filter.ts_from,
                        lte: filter.ts_to
                    }
                }
            });
        }

        const salida = await elastic.search<ILogErrorES>({
            index: Error.getAlias(),
            from: (page-1)*perPage,
            size: perPage,
            query: {
                bool: {
                    must
                }
            },
            sort: [
                {
                    "@timestamp": {
                        order: "desc"
                    }
                }
            ],
            // Sin esto Elasticsearch deja de contar en 10.000 y el paginador no sabría cuántas páginas
            // hay. El coste es contar el índice filtrado, no traérselo.
            track_total_hits: true,
            // El reparto para la gráfica, en la misma consulta que la página: una agregación cuenta sobre
            // todo lo que casa con el filtro, así que no hace falta —ni serviría— calcularlo en el
            // cliente a partir de los registros de una página.
            aggs: {
                [AGG_DISTRIBUCION]: {
                    auto_date_histogram: {
                        field: "@timestamp",
                        buckets: HISTOGRAM_BUCKETS,
                    },
                },
            },
        });

        const total = typeof salida.hits.total === "number"
            ? salida.hits.total
            : salida.hits.total?.value ?? 0;

        const logs = salida.hits.hits.map(hit => {
            const data = hit._source!;
            return new Error({
                timestamp: new Date(data["@timestamp"]),
                checked: data.checked,
                proyecto: data.proyecto,
                servicio: data.servicio,
                url: data.url,
                mensaje: data.mensaje,
                archivo: data.archivo,
                linea: data.linea,
                traza: data.traza ? (Array.isArray(data.traza) ? data.traza : [data.traza]) : [],
                ctx: data.ctx ? (Array.isArray(data.ctx) ? data.ctx : [data.ctx]) : []
            });
        });

        return {
            logs,
            total,
            reachable: Math.min(total, maxPage*perPage),
            histogram: distribucion(salida.aggregations?.[AGG_DISTRIBUCION]),
        };
    }

    /**
     * Recupera los posibles valores de los filtros de los logs de servicios filtrando por proyectos.
     * @param projects Proyectos a filtrar.
     */
    public static async filterValues(projects: string[]): Promise<IFilterValues> {
        const result: IFilterValues = {
            servicio: [],
            archivo: [],
            linea: [],
            url: []
        };

        const salida = await elastic.search<ILogErrorES, ESAggregator>({
            index: Error.getAlias(),
            size: 0,
            query: {
                bool: {
                    must: [
                        {
                            terms: {
                                proyecto: projects
                            }
                        },
                        {
                            term: {
                                checked: false
                            }
                        }
                    ]
                }
            },
            aggs: {
                'by-servicio': {
                    terms: {
                        field: 'servicio',
                        size: 100
                    }
                },
                'by-archivo': {
                    terms: {
                        field: 'archivo',
                        size: 100
                    }
                },
                'by-linea': {
                    terms: {
                        field: 'linea',
                        size: 500
                    }
                },
                'by-url': {
                    terms: {
                        field: 'url',
                        size: 500
                    }
                }
            }
        });

        result.servicio = (salida.aggregations?.['by-servicio']?.buckets as AggregationsStringTermsBucket[])?.map(bucket => bucket.key as string)||[];
        result.archivo = (salida.aggregations?.['by-archivo']?.buckets as AggregationsStringTermsBucket[])?.map(bucket => bucket.key as string)||[];
        result.linea = (salida.aggregations?.['by-linea']?.buckets as AggregationsStringTermsBucket[])?.map(bucket => parseInt(bucket.key as string)||0)||[];
        result.url = (salida.aggregations?.['by-url']?.buckets as AggregationsStringTermsBucket[])?.map(bucket => bucket.key as string)||[];

        result.servicio.sort();
        result.archivo.sort();
        result.linea.sort((a, b) => a - b);
        result.url.sort();

        return result;
    }

    /**
     * Marca como revisados los logs de errores que coincidan con los filtros.
     * @param request Filtros a aplicar
     */
    public static async delete(request: IDelete): Promise<number> {
        const must: QueryDslQueryContainer[] = [
            {
                term: {
                    proyecto: request.proyecto
                }
            }
        ];

        if (request.ts) {
            must.push({
                term: {
                    "@timestamp": request.ts
                }
            });
        }

        if (request.servicio) {
            must.push({
                term: {
                    servicio: request.servicio
                }
            });
        }

        if (request.archivo) {
            must.push({
                term: {
                    archivo: request.archivo
                }
            });
        }

        if (request.linea) {
            must.push({
                term: {
                    linea: request.linea
                }
            });
        }

        if (request.url) {
            must.push({
                term: {
                    url: request.url
                }
            });
        }

        const result = await elastic.updateByQuery({
            index: Error.getAlias(),
            query: {
                bool: {
                    must
                }
            },
            script: {
                source: "ctx._source.checked = true"
            },
            refresh: true
        });

        return result.updated??0;
    }

    /* INSTANCE */
}
