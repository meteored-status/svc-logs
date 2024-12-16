import {LogError as LogErrorBase, type ILogErrorES} from "logs-base/modules/data/log/error";
import elastic, {
    AggregationsStringTermsAggregate,
    AggregationsStringTermsBucket,
    QueryDslQueryContainer
} from "services-comun/modules/utiles/elastic";

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

export class LogError extends LogErrorBase {
    /* STATIC */

    /**
     * Busca logs de errores aplicando filtros y paginación.
     * @param filter Filtros a aplicar
     * @param pagination Paginación a aplicar
     */
    public static async search(filter: SearchFilter, {page = 1, perPage= 15}: SearchPagination): Promise<LogError[]> {
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
            index: LogErrorBase.getAlias(),
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
            ]
        });


        return salida.hits.hits.map(hit => {
            const data = hit._source!;
            return new LogError({
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
            index: this.getAlias(),
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
            index: this.getAlias(),
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
