/**
 * Editor: José Antonio Jiménez
 * Fecha: Wed, 05 Aug 2026 06:32:07 GMT
 * Hash: ad8bad837a970dcf11222a50938c53b6
 * Versión: 2026.8.5+1-josantoniojimnez
 * Anterior: 2026.8.3+1-josantoniojimnez
 * Proyecto: https://github.com/alpred/meteored-svc-localizacion.git
 */

import type {ClientOptions} from "@elastic/elasticsearch/client";
import type {ConnectionOptions as TlsConnectionOptions} from "node:tls";
import {type estypes, Client} from "@elastic/elasticsearch";

import {exists, readFile, readJSON} from "../utiles/fs";
import {PromiseDelayed} from "../utiles/promise";

/*
 * Re-exportamos aquí los tipos de `@elastic/elasticsearch` (`estypes`) que usa el resto del
 * monorepo, para que los workspaces consumidores importen desde este módulo sin depender
 * directamente de `estypes`.
 */
export type AggregateName = estypes.AggregateName;
export type AggregationsMultiBucketAggregateBase<T> = estypes.AggregationsMultiBucketAggregateBase;
export type AggregationsAggregate = estypes.AggregationsAggregate;
export type AggregationsTermsAggregateBase<T=unknown> = estypes.AggregationsTermsAggregateBase<T>;
export type AggregationsStringTermsBucket = estypes.AggregationsStringTermsBucket;
export type AggregationsStringTermsAggregate = estypes.AggregationsStringTermsAggregate;
export type BulkOperationContainer = estypes.BulkOperationContainer;
export type BulkOperationType = estypes.BulkOperationType;
export type BulkRequest = estypes.BulkRequest;
export type BulkResponse = estypes.BulkResponse;
export type BulkResponseItem = estypes.BulkResponseItem;
export type BulkUpdateAction<T, K> = estypes.BulkUpdateAction<T, K>;
export type CcrPauseFollowRequest = estypes.CcrPauseFollowRequest;
export type CcrPauseFollowResponse = estypes.CcrPauseFollowResponse;
export type CcrStatsFollowStats = estypes.CcrStatsFollowStats;
export type CcrStatsResponse = estypes.CcrStatsResponse;
export type CcrUnfollowRequest = estypes.CcrUnfollowRequest;
export type CcrUnfollowResponse = estypes.CcrUnfollowResponse;
export type ClearScrollRequest = estypes.ClearScrollRequest;
export type ClearScrollResponse = estypes.ClearScrollResponse;
export type ClosePointInTimeRequest = estypes.ClosePointInTimeRequest;
export type ClosePointInTimeResponse = estypes.ClosePointInTimeResponse;
export type CreateRequest = estypes.CreateRequest;
export type CreateResponse = estypes.CreateResponse;
export type CountRequest = estypes.CountRequest;
export type CountResponse = estypes.CountResponse;
export type DeleteByQueryRequest = estypes.DeleteByQueryRequest;
export type DeleteByQueryResponse = estypes.DeleteByQueryResponse;
export type DeleteRequest = estypes.DeleteRequest;
export type DeleteResponse = estypes.DeleteResponse;
export type GetRequest = estypes.GetRequest;
export type GetResponse<T> = estypes.GetResponse<T>;
export type IndexRequest = estypes.IndexRequest;
export type IndexResponse = estypes.IndexResponse;
export type IndicesCreateRequest = estypes.IndicesCreateRequest;
export type IndicesCreateResponse = estypes.IndicesCreateResponse;
export type IndicesDeleteRequest = estypes.IndicesDeleteRequest;
export type IndicesDeleteResponse = estypes.IndicesDeleteResponse;
export type IndicesExistsAliasRequest = estypes.IndicesExistsAliasRequest;
export type IndicesExistsAliasResponse = estypes.IndicesExistsAliasResponse;
export type IndicesExistsRequest = estypes.IndicesExistsRequest;
export type IndicesExistsResponse = estypes.IndicesExistsResponse;
export type IndicesForcemergeRequest = estypes.IndicesForcemergeRequest;
export type IndicesForcemergeResponse = estypes.IndicesForcemergeResponse;
export type IndicesGetAliasRequest = estypes.IndicesGetAliasRequest;
export type IndicesGetAliasResponse = estypes.IndicesGetAliasResponse;
export type IndicesGetRequest = estypes.IndicesGetRequest;
export type IndicesGetResponse = estypes.IndicesGetResponse;
export type IndicesUpdateAliasesAction = estypes.IndicesUpdateAliasesAction;
export type IndicesUpdateAliasesRequest = estypes.IndicesUpdateAliasesRequest;
export type IndicesUpdateAliasesResponse = estypes.IndicesUpdateAliasesResponse;
export type InfoRequest = estypes.InfoRequest;
export type InfoResponse = estypes.InfoResponse;
export type NodesStatsResponse = estypes.NodesStatsResponse;
export type NodesStats = estypes.NodesStats;
export type NodesOperatingSystem = estypes.NodesOperatingSystem;
export type NodesCpu = estypes.NodesCpu;
export type NodesExtendedMemoryStats = estypes.NodesExtendedMemoryStats;
export type OpenPointInTimeRequest = estypes.OpenPointInTimeRequest;
export type OpenPointInTimeResponse = estypes.OpenPointInTimeResponse;
export type QueryDslQueryContainer = estypes.QueryDslQueryContainer;
export type Refresh = estypes.Refresh;
export type ReindexRequest = estypes.ReindexRequest;
export type ReindexResponse = estypes.ReindexResponse;
export type Script = estypes.Script;
export type ScrollRequest = estypes.ScrollRequest;
export type ScrollResponse<T> = estypes.ScrollResponse<T>;
export type SearchCompletionSuggestOption<T> = estypes.SearchCompletionSuggestOption<T>;
export type SearchHit<T> = estypes.SearchHit<T>;
export type SearchPhraseSuggestOption = estypes.SearchPhraseSuggestOption;
export type SearchRequest = estypes.SearchRequest;
export type SearchTotalHits = estypes.SearchTotalHits;
export type SortResults = estypes.SortResults;
export type SearchResponse<T, K> = estypes.SearchResponse<T, K>;
export type SearchSuggest<T> = estypes.SearchSuggest<T>;
export type SearchFieldSuggester = estypes.SearchFieldSuggester;
export type SearchSuggester = estypes.SearchSuggester;
export type SearchTermSuggestOption = estypes.SearchTermSuggestOption;
export type Sort = estypes.Sort;
export type SuggestionName = estypes.SuggestionName;
export type UpdateByQueryRequest = estypes.UpdateByQueryRequest;
export type UpdateByQueryResponse = estypes.UpdateByQueryResponse;
export type UpdateRequest = estypes.UpdateRequest;
export type UpdateResponse<T> = estypes.UpdateResponse<T>;

/** Mapa de agregaciones de una respuesta de búsqueda, indexado por el nombre de la agregación. */
export type ESAggregate = Record<AggregateName, AggregationsAggregate>;
/** Mapa de sugerencias de una respuesta de búsqueda, indexado por el nombre del sugeridor. */
export type ESSuggest<T> = Record<SuggestionName, SearchSuggest<T>[]>;
/** Unión de las opciones de sugerencia que puede devolver cualquiera de los sugeridores soportados. */
export type ESSuggestOption<T> = SearchPhraseSuggestOption|SearchTermSuggestOption|SearchCompletionSuggestOption<T>;
/** Operación individual válida dentro de una petición `bulk`: metadatos de operación, acción de update o el documento completo. */
export type ESBulkOperation<TDocument=void> = (BulkOperationContainer | BulkUpdateAction<TDocument, Partial<TDocument>> | TDocument);
/** Resultado de un item de la respuesta de `bulk`, indexado por tipo de operación. */
export type ESBulkResponse = Partial<Record<BulkOperationType, BulkResponseItem>>;

/**
 * Datos de conexión comunes a un clúster de Elasticsearch, ya sea el principal o uno de failover.
 *
 * @property hosts - URLs de los nodos del clúster.
 * @property ca - Ruta al certificado CA para TLS. Ver {@link Elasticsearch["getCommonConfig"]} para cómo se resuelve si no existe en disco.
 */
interface IElasticSearchBase {
    hosts: string[];
    ca?: string;
}

/** Credenciales de un clúster que autentica mediante API key. */
interface IElasticSearchApiKey extends IElasticSearchBase {
    apiKey: string;
}
/** Credenciales de un clúster que autentica mediante usuario y contraseña. */
interface IElasticSearchBasic extends IElasticSearchBase {
    user: string;
    password: string;
}
/**
 * Forma del fichero JSON de credenciales de Elasticsearch (ruta indicada por `IESConfig.credenciales`).
 *
 * @property failover - Clústeres alternativos que reutilizan las mismas credenciales que el
 * principal (solo cambian `hosts`/`ca`). {@link ClienteFailover} recurre a ellos cuando una
 * operación de solo lectura falla contra el clúster principal.
 */
export type IElasticSearch = (IElasticSearchApiKey | IElasticSearchBasic) & {
    failover?: IElasticSearchBase[];
};

/**
 * Metadatos de un documento de Elasticsearch.
 *
 * @property index - Índice al que pertenece el documento.
 * @property id - Identificador del documento.
 * @property version - Versión del documento, para control de concurrencia optimista.
 */
export interface IMetadata {
    index: string;
    id?: string;
    version?: number;
}

/**
 * Configuración con la que se instancia {@link Elasticsearch}.
 *
 * @property credenciales - Ruta al fichero JSON con las credenciales (ver {@link IElasticSearch}).
 * Si el fichero no existe, Elasticsearch queda deshabilitado y todas las operaciones rechazan.
 * @property ca - Ruta al certificado CA por defecto, usada cuando el fichero de credenciales no
 * especifica uno propio.
 */
export interface IESConfig {
    credenciales: string;
    ca?: string;
}

/**
 * Envuelve un cliente `Client` principal (`regular`) y, opcionalmente, uno o varios clientes de
 * failover que comparten credenciales pero apuntan a otros hosts. Solo se usa para operaciones de
 * solo lectura a través de {@link check}: si `regular` falla, se recorren los clientes de failover
 * en round-robin (retomando desde el siguiente al último usado) hasta que uno responda.
 */
class ClienteFailover {
    private readonly failover: Client[];
    private i: number;

    public constructor(public regular: Client) {
        this.failover = [];
        this.i = 0;
    }

    /** Registra un cliente adicional al que recurrir si `regular` falla. */
    public addFailover(cliente: Client): void {
        this.failover.push(cliente);
    }

    /**
     * Ejecuta `request` contra el cliente principal. Si falla y hay clientes de failover
     * registrados, los prueba uno a uno en round-robin hasta que alguno responda; si ninguno lo
     * hace, rechaza con el error original del cliente principal.
     */
    public async check<T>(request: (cliente: Client)=>Promise<T>): Promise<T> {
        try {
            return await request(this.regular);
        } catch (err) {
            if (this.failover.length===0) {
                return Promise.reject(err);
            }

            const i = this.i;

            do {
                this.i = (this.i + 1) % this.failover.length;
                try {
                    return await request(this.failover[this.i]);
                } catch (err) {
                    // seguimos intentando
                }
            } while (i!==this.i);

            return Promise.reject(err);
        }
    }
}

/**
 * Cliente de Elasticsearch del monorepo: carga las credenciales de forma perezosa (una sola vez,
 * cacheadas en {@link cliente}) desde el fichero indicado en `config.credenciales`, y expone
 * wrappers tipados sobre las operaciones del cliente oficial `@elastic/elasticsearch`.
 *
 * Las operaciones de solo lectura (`search`, `get`, `count`) recurren a un clúster de failover si
 * el principal falla (ver {@link ClienteFailover.check}); las operaciones de escritura van
 * siempre contra el clúster principal, para no dividir escrituras entre clústeres.
 */
export class Elasticsearch {
    protected _cliente?: Promise<ClienteFailover>;
    /** Cliente cacheado; el primer acceso dispara la carga perezosa de credenciales. */
    protected get cliente(): Promise<ClienteFailover> {
        return this._cliente ??= this.load();
    }

    public constructor(protected config: IESConfig) {
    }

    private async load(): Promise<ClienteFailover> {
        return this.loadConfig()
            .catch(()=>Promise.reject(new Error("Elastic not enabled")));
    }

    /** Libera un scroll abierto previamente, para no mantenerlo vivo hasta que expire por timeout. */
    public async clearScroll(params: ClearScrollRequest): Promise<ClearScrollResponse> {
        const cliente = await this.cliente;
        return cliente.regular.clearScroll(params);
    }

    /** Elimina un documento por id. */
    public async delete(params: DeleteRequest): Promise<DeleteResponse> {
        const cliente = await this.cliente;
        return cliente.regular.delete(params);
    }

    /** Continúa una búsqueda con scroll abierta previamente mediante {@link search}. */
    public async scroll<T>(params: ScrollRequest): Promise<ScrollResponse<T>> {
        const cliente = await this.cliente;
        return cliente.regular.scroll<T>(params);
    }

    /** Busca documentos. Si el clúster principal falla, reintenta contra un clúster de failover. */
    public async search<T, K extends ESAggregate = ESAggregate>(params: SearchRequest): Promise<SearchResponse<T, K>> {
        const cliente = await this.cliente;
        return cliente.check(cliente=>cliente.search<T, K>(params));
    }

    /** Obtiene un documento por id. Si el clúster principal falla, reintenta contra un clúster de failover. */
    public async get<T>(params: GetRequest): Promise<GetResponse<T>> {
        const cliente = await this.cliente;
        return cliente.check(cliente=>cliente.get(params));
    }

    /** Indexa (crea o reemplaza) un documento. */
    public async index(params: IndexRequest): Promise<IndexResponse> {
        const cliente = await this.cliente;
        return cliente.regular.index(params);
    }

    /** Crea un documento, fallando si ya existe uno con el mismo id. */
    public async create(params: CreateRequest): Promise<CreateResponse> {
        const cliente = await this.cliente;
        return cliente.regular.create(params);
    }

    /** Reindexa documentos desde un índice/query de origen a un índice destino. */
    public async reindex(params: ReindexRequest): Promise<ReindexResponse> {
        const cliente = await this.cliente;
        return cliente.regular.reindex(params);
    }

    /** Actualiza parcialmente un documento existente. */
    public async update<T>(params: UpdateRequest): Promise<UpdateResponse<T>> {
        const cliente = await this.cliente;
        return cliente.regular.update(params);
    }

    /** Abre un point-in-time, para que varias búsquedas sucesivas vean un snapshot consistente del índice. */
    public async openPointInTime(params: OpenPointInTimeRequest): Promise<OpenPointInTimeResponse> {
        const cliente = await this.cliente;
        return cliente.regular.openPointInTime(params);
    }

    /** Cierra un point-in-time abierto previamente con {@link openPointInTime}. */
    public async closePointInTime(params: ClosePointInTimeRequest): Promise<ClosePointInTimeResponse> {
        const cliente = await this.cliente;
        return cliente.regular.closePointInTime(params);
    }

    /** Elimina todos los documentos que cumplan una query. */
    public async deleteByQuery(params: DeleteByQueryRequest): Promise<DeleteByQueryResponse> {
        const cliente = await this.cliente;
        return cliente.regular.deleteByQuery(params);
    }

    /** Actualiza todos los documentos que cumplan una query. */
    public async updateByQuery(params: UpdateByQueryRequest): Promise<UpdateByQueryResponse> {
        const cliente = await this.cliente;
        return cliente.regular.updateByQuery(params);
    }

    /** Cuenta los documentos que cumplen una query. Si el clúster principal falla, reintenta contra un clúster de failover. */
    public async count(params: CountRequest): Promise<CountResponse> {
        const cliente = await this.cliente;
        return cliente.check(cliente=>cliente.count(params));
    }

    /**
     * Ejecuta una petición bulk (varias operaciones de escritura en una sola llamada).
     *
     * A diferencia del resto de métodos, no reutiliza el cliente cacheado en {@link cliente}:
     * abre un cliente nuevo y lo cierra al terminar, para que las peticiones bulk (potencialmente
     * grandes y frecuentes en cargas masivas) no compitan por la misma conexión que usan las
     * búsquedas normales.
     */
    public async bulk(params: BulkRequest): Promise<BulkResponse> {
        const cliente = await this.load();
        try {
            return await cliente.regular.bulk(params);
        } finally {
            await cliente.regular.close();
        }
    }

    /** Obtiene información general del clúster (versión, nombre, etc.). */
    public async info(params: InfoRequest = {}): Promise<InfoResponse> {
        const cliente = await this.cliente;
        return cliente.regular.info(params);
    }

    /** Crea un índice. */
    public async indicesCreate(params: IndicesCreateRequest): Promise<IndicesCreateResponse> {
        const cliente = await this.cliente;
        return cliente.regular.indices.create(params);
    }

    /** Elimina un índice. */
    public async indicesDelete(params: IndicesDeleteRequest): Promise<IndicesDeleteResponse> {
        const cliente = await this.cliente;
        return cliente.regular.indices.delete(params);
    }

    /** Comprueba si un índice existe. */
    public async indicesExists(params: IndicesExistsRequest): Promise<IndicesExistsResponse> {
        const cliente = await this.cliente;
        return cliente.regular.indices.exists(params);
    }

    /** Comprueba si un alias existe. */
    public async indicesExistsAlias(params: IndicesExistsAliasRequest): Promise<IndicesExistsAliasResponse> {
        const cliente = await this.cliente;
        return cliente.regular.indices.existsAlias(params);
    }

    /** Fuerza el merge de segmentos de un índice. */
    public async indicesForcemerge(params: IndicesForcemergeRequest): Promise<IndicesForcemergeResponse> {
        const cliente = await this.cliente;
        return cliente.regular.indices.forcemerge(params);
    }

    /** Obtiene la definición de uno o varios índices. */
    public async indicesGet(params: IndicesGetRequest): Promise<IndicesGetResponse> {
        const cliente = await this.cliente;
        return cliente.regular.indices.get(params);
    }

    /** Obtiene los alias asociados a uno o varios índices. */
    public async indicesGetAlias(params: IndicesGetAliasRequest): Promise<IndicesGetAliasResponse> {
        const cliente = await this.cliente;
        return cliente.regular.indices.getAlias(params);
    }

    /** Añade o elimina alias de forma atómica. */
    public async indicesUpdateAliases(params: IndicesUpdateAliasesRequest): Promise<IndicesUpdateAliasesResponse> {
        const cliente = await this.cliente;
        return cliente.regular.indices.updateAliases(params);
    }

    /**
     * Espera hasta que el clúster esté disponible, reintentando con backoff lineal
     * (`intento * 100` ms) hasta 20 intentos. Rechaza si sigue sin estar disponible al agotarlos.
     *
     * @param intento - Número de intento actual; uso interno para la recursión del backoff.
     */
    public async ready(intento: number = 1): Promise<void> {
        if (!await this.disponible()) {
            if (intento <= 20) {
                await PromiseDelayed(intento * 100);
                return this.ready(intento + 1);
            }
            return Promise.reject("Elastic not available");
        }
    }

    /** Obtiene estadísticas de cross-cluster replication (CCR). */
    public async ccrStats(): Promise<CcrStatsResponse> {
        const cliente = await this.cliente;
        return cliente.regular.ccr.stats();
    }

    /** Pausa una relación de follow de CCR. */
    public async ccrPauseFollow(params: CcrPauseFollowRequest): Promise<CcrPauseFollowResponse> {
        const cliente = await this.cliente;
        return cliente.regular.ccr.pauseFollow(params);
    }

    /** Detiene permanentemente una relación de follow de CCR. */
    public async ccrUnfollow(params: CcrUnfollowRequest): Promise<CcrUnfollowResponse> {
        const cliente = await this.cliente;
        return cliente.regular.ccr.unfollow(params);
    }

    /** Comprueba si el clúster responde, sin propagar el error si no es así. */
    public async disponible(): Promise<boolean> {
        return this.info()
            .then(()=>true)
            .catch(()=>false);
    }

    /**
     * Busca el primer índice `<base>-NNN` (sufijo numérico de 3 cifras) que no exista todavía,
     * para usarlo como nombre de un índice nuevo. Recursivo: en el peor caso hace tantas
     * peticiones `indicesExists` como índices `<base>-NNN` ya existan.
     *
     * @param base - Prefijo del índice, sin el sufijo numérico.
     * @param i - Primer número de sufijo a probar.
     */
    public async searchLibre(base: string, i: number = 1): Promise<string> {
        const index = `${base}-${`00${i}`.slice(-3)}`;
        const respuesta = await this.indicesExists({
            index,
        });
        if (!respuesta) {
            return index;
        }

        return this.searchLibre(base, i+1);
    }

    /** Obtiene estadísticas de los nodos del clúster. */
    public async nodes(): Promise<NodesStatsResponse> {
        const cliente = await this.cliente;
        return cliente.regular.nodes.stats();
    }

    /**
     * Carga las credenciales desde disco ({@link IESConfig.credenciales}) y construye el cliente
     * principal junto con los clientes de failover declarados en `failover`, si los hay. Rechaza
     * si el fichero de credenciales no existe o no tiene una forma reconocida.
     */
    protected async loadConfig(): Promise<ClienteFailover> {
        if (!await exists(this.config.credenciales)) {
            return Promise.reject(new Error("Elastic disabled"));
        }

        const config: IElasticSearch = await readJSON<IElasticSearch>(this.config.credenciales);
        const common = await this.getCommonConfig(config, config.ca ?? this.config.ca);

        let cliente: ClienteFailover;
        if ("apiKey" in config) {
            cliente = new ClienteFailover(this.crearClienteApiKey(config, common));
            if (config.failover) {
                for (const failover of config.failover) {
                    cliente.addFailover(this.crearClienteApiKey(config, await this.getCommonConfig(failover, failover.ca ?? this.config.ca)))
                }
            }
        } else if ("user" in config) {
            cliente = new ClienteFailover(this.crearClienteBasic(config, common));
            if (config.failover) {
                for (const failover of config.failover) {
                    cliente.addFailover(this.crearClienteBasic(config, await this.getCommonConfig(failover, failover.ca ?? this.config.ca)))
                }
            }
        } else {
            return Promise.reject(new Error("Elastic disabled"));
        }


        return cliente;
    }

    /**
     * Construye las opciones de conexión comunes (hosts, TLS, compresión, timeout) a partir de
     * una entrada de credenciales (principal o de failover).
     *
     * Resolución de `ca`: si se indica una ruta y existe en disco, se usa como CA con
     * verificación estricta. Si no existe: en producción no se aplica TLS custom (se usa la
     * verificación por defecto de Node); fuera de producción se desactiva la verificación
     * (`rejectUnauthorized: false`), para no bloquear entornos de desarrollo con certificados
     * autofirmados. Si no se indica `ca` pero estamos en desarrollo, también se desactiva la
     * verificación.
     */
    private async getCommonConfig(config: IElasticSearchBase, ca?: string): Promise<ClientOptions> {
        let tls: TlsConnectionOptions|undefined;
        if (ca) {
            if (!PRODUCCION) {
                if (await exists(ca)) {
                    tls = {
                        ca: await readFile(ca),
                        rejectUnauthorized: true,
                    };
                } else {
                    tls = {
                        rejectUnauthorized: false,
                    };
                }
            } else if (await exists(ca)) {
                tls = {
                    ca: await readFile(ca),
                    rejectUnauthorized: true,
                };
            }
        } else if (DESARROLLO) {
            tls = {
                rejectUnauthorized: false,
            }
        }

        return {
            nodes: config.hosts,
            compression: true,//!config.hosts.map(actual=>actual.startsWith("https://")).reduce((actual, acumulado)=>actual||acumulado),
            tls,
            requestTimeout: 60000,
        };
    }

    /** Crea un `Client` de Elasticsearch autenticado con API key. */
    private crearClienteApiKey(config: IElasticSearchApiKey, common: ClientOptions): Client {
        return new Client({
            ...common,
            auth: {
                apiKey: config.apiKey,
            },
        });
    }

    /** Crea un `Client` de Elasticsearch autenticado con usuario y contraseña. */
    private crearClienteBasic(config: IElasticSearchBasic, common: ClientOptions): Client {
        return new Client({
            ...common,
            auth: {
                username: config.user,
                password: config.password,
            },
        });
    }
}
