import {
    Elasticsearch,
    type ESAggregate,
    type QueryDslQueryContainer,
    type SearchHit,
    type SearchRequest,
    type SearchResponse,
    type Sort,
    type SortResults,
} from "../../elasticsearch";

export type {IMetadata} from "../../elasticsearch";
export type * from "../../elasticsearch";

/**
 * Busca todos los elementos en los índices de elastic.
 * @param client Cliente de elastic.
 * @param config Configuración de la búsqueda.
 * @param query Consulta.
 * @param sort Ordenación.
 * @private
 */
export const searchAll = async <I>(client: Elasticsearch, config: {index: string; keep_alive: string; size: number; source?: string[]}, query: QueryDslQueryContainer, sort?: Sort): Promise<SearchResponse<I, ESAggregate>> => {
    // Creamos el Point In Time (pit)
    const pit = await client.openPointInTime({
        index: config.index,
        keep_alive: config.keep_alive
    });

    const queryFunction = async (size: number, pit: string, after?: SortResults): Promise<[SearchResponse<I, ESAggregate>, SortResults|undefined]> => {
        const params: SearchRequest = {
            size,
            query,
            pit: {
                id: pit,
                keep_alive: config.keep_alive,
            },
            sort: sort ?? [
                {
                    _shard_doc: "asc",
                },
            ],
            _source: config.source,
            search_after: after
        };

        const data = await client.search<I>(params);

        return [
            data,
            (data.hits.hits.length == 0)
                ? undefined
                : data.hits.hits[data.hits.hits.length - 1].sort
        ];
    }

    let resultados: SearchResponse<I, ESAggregate>|undefined = undefined;

    // let init: number = Date.now();

    let [bloque, after]: [SearchResponse<I, ESAggregate>|undefined, SortResults|undefined] = [undefined, undefined];

    do {
        [bloque, after] = await queryFunction(config.size, pit.id, after);
        if (!resultados) {
            resultados = bloque;
        } else {
            resultados.hits.hits = resultados.hits.hits.concat(bloque.hits.hits);
        }
    } while (bloque.hits.hits.length == config.size);

    await client.closePointInTime({
        id: pit.id
    });

    // let end: number = Date.now();

    // if (!PRODUCCION || TEST) {
    //     console.log("Tiempo de búsqueda: " + (end - init) + "ms");
    // }

    return resultados;
}

/**
 * Busca todos los elementos en los índices de elastic.
 * @param client Cliente de elastic.
 * @param config Configuración de la búsqueda.
 * @param query Consulta.
 * @param fn Función de mapeo.
 * @param sort Ordenación.
 * @private
 */
export const searchAllFn = async <T, I>(client: Elasticsearch, config: {index: string; keep_alive: string; size: number;}, query: QueryDslQueryContainer, fn: (hit: SearchHit<I>) => T, sort?: Sort): Promise<T[]> => {
    const resultados = await searchAll<I>(client, config, query, sort);
    return resultados.hits.hits.map(fn);
}

export default new Elasticsearch({
    credenciales: "files/credenciales/elastic.json",
    ca: "files/ssl/elastic-ca.crt",
});
