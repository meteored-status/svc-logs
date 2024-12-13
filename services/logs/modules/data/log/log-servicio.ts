import {LogServicio as LogServicioBase, type ILogServicioES} from "logs-base/modules/data/log/servicio";
import {
    AggregationsStringTermsAggregate,
    AggregationsStringTermsBucket,
    QueryDslQueryContainer
} from "services-comun/modules/elasticsearch";
import elastic from "services-comun/modules/utiles/elastic";

interface SearchFilter {
    projects: string[];
    severidad?: string;
    servicios?: string[];
    tipos?: string[];
    ts_from?: number;
    ts_to?: number;
}

interface SearchPagination {
    page?: number;
    perPage?: number;
}

interface IFilterValues {
    servicio: string[];
    tipo: string[];
}

type Agregador = AggregationsStringTermsAggregate;
type ESAggregator = {
    'by-servicio': Agregador;
    'by-tipo': Agregador;
}

interface IDeleteFilter {
    projects: string[];
    timestamp?: number;
    severidades?: string[];
    servicios?: string[];
    tipos?: string[];
    mensajes?: string[];
}

export class LogServicio extends LogServicioBase {
    /* STATIC */

    /**
     * Busca logs de servicios aplicando filtros y paginación.
     * @param filter Filtros a aplicar
     * @param pagination Paginación a aplicar
     */
    public static async search(filter: SearchFilter, pagination: SearchPagination): Promise<LogServicio[]> {

        const {projects} = filter;
        const {page, perPage} = {
            page: 1,
            perPage: 15,
            ...pagination
        };

        const must: QueryDslQueryContainer[] = [
            {
                terms: {
                    proyecto: projects
                }
            }
        ];

        if (filter.severidad != undefined) {
            must.push({
                term: {
                    severidad: filter.severidad
                }
            });
        }

        if (filter.servicios != undefined && filter.servicios.length > 0) {
            must.push({
                terms: {
                    servicio: filter.servicios
                }
            });
        }

        if (filter.tipos != undefined && filter.tipos.length > 0) {
            must.push({
                terms: {
                    tipo: filter.tipos
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

        const salida = await elastic.search<ILogServicioES>({
            index: this.getAlias(),
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
            return new LogServicio({
                timestamp: new Date(data["@timestamp"]),
                proyecto: data.proyecto,
                servicio: data.servicio,
                tipo: data.tipo,
                severidad: data.severidad,
                mensaje: data.mensaje,
                extra: data.extra ? (Array.isArray(data.extra) ? data.extra : [data.extra]) : []
            })
        });
    }

    /**
     * Recupera los posibles valores de los filtros de los logs de servicios filtrando por proyectos.
     * @param projects Proyectos a filtrar.
     */
    public static async filterValues(projects: string[]): Promise<IFilterValues> {
        const result: IFilterValues = {
            servicio: [],
            tipo: []
        };

        const salida = await elastic.search<ILogServicioES, ESAggregator>({
            index: this.getAlias(),
            size: 0,
            query: {
                bool: {
                    must: [
                        {
                            terms: {
                                proyecto: projects
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
                'by-tipo': {
                    terms: {
                        field: 'tipo',
                        size: 100
                    }
                }
            }
        });

        result.servicio = (salida.aggregations?.['by-servicio'].buckets as AggregationsStringTermsBucket[]).map(bucket => bucket.key as string);
        result.tipo = (salida.aggregations?.['by-tipo'].buckets as AggregationsStringTermsBucket[]).map(bucket => bucket.key as string);

        result.servicio.sort();
        result.tipo.sort();

        return result;
    }

    /**
     * Elimina logs de servicios aplicando filtros.
     * @param filter Filtros a aplicar
     */
    public static async delete(filter: IDeleteFilter): Promise<void> {
        const {projects} = filter;
        const must: QueryDslQueryContainer[] = [
            {
                terms: {
                    proyecto: projects
                }
            }
        ];

        if (filter.timestamp) {
            must.push({
                term: {
                    "@timestamp": filter.timestamp
                }
            });
        }

        if (filter.severidades != undefined && filter.severidades.length > 0) {
            must.push({
                terms: {
                    severidad: filter.severidades
                }
            });
        }

        if (filter.servicios != undefined && filter.servicios.length > 0) {
            must.push({
                terms: {
                    servicio: filter.servicios
                }
            });
        }

        if (filter.tipos != undefined && filter.tipos.length > 0) {
            must.push({
                terms: {
                    tipo: filter.tipos
                }
            });
        }

        if (filter.mensajes != undefined && filter.mensajes.length > 0) {
            must.push({
                terms: {
                    mensaje: filter.mensajes
                }
            });
        }

        await elastic.deleteByQuery({
            index: this.getAlias(),
            query: {
                bool: {
                    must
                }
            }
        });
    }

    /* INSTANCE */
}
