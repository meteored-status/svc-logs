import type {ClientOptions} from "@elastic/elasticsearch/client";
import type {ConnectionOptions as TlsConnectionOptions} from "node:tls";
import {type estypes, Client} from "@elastic/elasticsearch";

import {exists, readFile, readJSON} from "../utiles/fs";
import {PromiseDelayed} from "../utiles/promise";

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

export type ESAggregate = Record<AggregateName, AggregationsAggregate>;
export type ESSuggest<T> = Record<SuggestionName, SearchSuggest<T>[]>;
export type ESSuggestOption<T> = SearchPhraseSuggestOption|SearchTermSuggestOption|SearchCompletionSuggestOption<T>;
export type ESBulkOperation<TDocument=void> = (BulkOperationContainer | BulkUpdateAction<TDocument, Partial<TDocument>> | TDocument);
export type ESBulkResponse = Partial<Record<BulkOperationType, BulkResponseItem>>;

interface IElasticSearchBase {
    hosts: string[];
    ca?: string;
}

interface IElasticSearchApiKey extends IElasticSearchBase {
    apiKey: string;
}
interface IElasticSearchBasic extends IElasticSearchBase {
    user: string;
    password: string;
}
export type IElasticSearch = (IElasticSearchApiKey | IElasticSearchBasic) & {
    failover?: IElasticSearchBase[];
};

export interface IMetadata {
    index: string;
    id?: string;
    version?: number;
}

export interface IESConfig {
    credenciales: string;
    ca?: string;
}

class ClienteFailover {
    private readonly failover: Client[];
    private i: number;

    public constructor(public regular: Client) {
        this.failover = [];
        this.i = 0;
    }

    public addFailover(cliente: Client): void {
        this.failover.push(cliente);
    }

    public async check<T>(request: (cliente: Client)=>Promise<T>): Promise<T> {
        try {
            return await request(this.regular);
        } catch (err) {
            if (this.failover.length===0) {
                return Promise.reject(err);
            }

            if (this.failover.length===0) {
                return await request(this.failover[0]);
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

export class Elasticsearch {
    protected cliente: Promise<ClienteFailover>;

    public constructor(protected config: IESConfig) {
        this.cliente = this.load();

        // esto se hace por seguridad
        this.cliente.then(()=>undefined).catch(()=>undefined);
    }

    private async load(): Promise<ClienteFailover> {
        return this.loadConfig()
            .catch(()=>Promise.reject("Elastic not enabled"));
    }

    public async clearScroll(params: ClearScrollRequest): Promise<ClearScrollResponse> {
        const cliente = await this.cliente;
        return cliente.regular.clearScroll(params);
    }

    public async delete(params: DeleteRequest): Promise<DeleteResponse> {
        const cliente = await this.cliente;
        return cliente.regular.delete(params);
    }

    public async scroll<T>(params: ScrollRequest): Promise<ScrollResponse<T>> {
        const cliente = await this.cliente;
        return cliente.regular.scroll<T>(params);
    }

    public async search<T, K extends ESAggregate = ESAggregate>(params: SearchRequest): Promise<SearchResponse<T, K>> {
        const cliente = await this.cliente;
        return cliente.check(cliente=>cliente.search<T, K>(params));
        // return cliente.regular.search<T, K>(params);
    }

    public async get<T>(params: GetRequest): Promise<GetResponse<T>> {
        const cliente = await this.cliente;
        return cliente.check(cliente=>cliente.get(params, {
            // ignore: [404],
        }));
        // return cliente.regular.get(params, {
        //     // ignore: [404],
        // });
    }

    public async index(params: IndexRequest): Promise<IndexResponse> {
        const cliente = await this.cliente;
        return cliente.regular.index(params);
    }

    public async create(params: CreateRequest): Promise<CreateResponse> {
        const cliente = await this.cliente;
        return cliente.regular.create(params);
    }

    public async reindex(params: ReindexRequest): Promise<ReindexResponse> {
        const cliente = await this.cliente;
        return cliente.regular.reindex(params);
    }

    public async update<T>(params: UpdateRequest): Promise<UpdateResponse<T>> {
        const cliente = await this.cliente;
        return cliente.regular.update(params);
    }

    public async openPointInTime(params: OpenPointInTimeRequest): Promise<OpenPointInTimeResponse> {
        const cliente = await this.cliente;
        return cliente.regular.openPointInTime(params);
    }

    public async closePointInTime(params: ClosePointInTimeRequest): Promise<ClosePointInTimeResponse> {
        const cliente = await this.cliente;
        return cliente.regular.closePointInTime(params);
    }

    public async deleteByQuery(params: DeleteByQueryRequest): Promise<DeleteByQueryResponse> {
        const cliente = await this.cliente;
        return cliente.regular.deleteByQuery(params);
    }

    public async updateByQuery(params: UpdateByQueryRequest): Promise<UpdateByQueryResponse> {
        const cliente = await this.cliente;
        return cliente.regular.updateByQuery(params);
    }

    public async count(params: CountRequest): Promise<CountResponse> {
        const cliente = await this.cliente;
        return cliente.check(cliente=>cliente.count(params));
        // return cliente.regular.count(params);
    }

    public async bulk(params: BulkRequest): Promise<BulkResponse> {
        const cliente = await this.load();
        try {
            return await cliente.regular.bulk(params);
        } finally {
            await cliente.regular.close();
        }
    }

    public async info(params: InfoRequest = {}): Promise<InfoResponse> {
        const cliente = await this.cliente;
        return cliente.regular.info(params);
    }

    public async indicesCreate(params: IndicesCreateRequest): Promise<IndicesCreateResponse> {
        const cliente = await this.cliente;
        return cliente.regular.indices.create(params);
    }

    public async indicesDelete(params: IndicesDeleteRequest): Promise<IndicesDeleteResponse> {
        const cliente = await this.cliente;
        return cliente.regular.indices.delete(params);
    }

    public async indicesExists(params: IndicesExistsRequest): Promise<IndicesExistsResponse> {
        const cliente = await this.cliente;
        return cliente.regular.indices.exists(params);
    }

    public async indicesExistsAlias(params: IndicesExistsAliasRequest): Promise<IndicesExistsAliasResponse> {
        const cliente = await this.cliente;
        return cliente.regular.indices.existsAlias(params);
    }

    public async indicesForcemerge(params: IndicesForcemergeRequest): Promise<IndicesForcemergeResponse> {
        const cliente = await this.cliente;
        return cliente.regular.indices.forcemerge(params);
    }

    public async indicesGet(params: IndicesGetRequest): Promise<IndicesGetResponse> {
        const cliente = await this.cliente;
        return cliente.regular.indices.get(params);
    }

    public async indicesGetAlias(params: IndicesGetAliasRequest): Promise<IndicesGetAliasResponse> {
        const cliente = await this.cliente;
        return cliente.regular.indices.getAlias(params);
    }

    public async indicesUpdateAliases(params: IndicesUpdateAliasesRequest): Promise<IndicesUpdateAliasesResponse> {
        const cliente = await this.cliente;
        return cliente.regular.indices.updateAliases(params);
    }

    public async ready(intento: number = 1): Promise<void> {
        if (!await this.disponible()) {
            if (intento <= 20) {
                await PromiseDelayed(intento * 100);
                return this.ready(intento + 1);
            }
            return Promise.reject("Elastic not available");
        }
    }

    public async ccrStats(): Promise<CcrStatsResponse> {
        const cliente = await this.cliente;
        return cliente.regular.ccr.stats();
    }

    public async ccrPauseFollow(params: CcrPauseFollowRequest): Promise<CcrPauseFollowResponse> {
        const cliente = await this.cliente;
        return cliente.regular.ccr.pauseFollow(params);
    }

    public async ccrUnfollow(params: CcrUnfollowRequest): Promise<CcrUnfollowResponse> {
        const cliente = await this.cliente;
        return cliente.regular.ccr.unfollow(params);
    }

    public async disponible(): Promise<boolean> {
        return this.info()
            .then(()=>true)
            .catch(()=>false);
    }

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

    public async nodes(): Promise<NodesStatsResponse> {
        const cliente = await this.cliente;
        return cliente.regular.nodes.stats();
    }

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

    private crearClienteApiKey(config: IElasticSearchApiKey, common: ClientOptions): Client {
        return new Client({
            ...common,
            auth: {
                apiKey: config.apiKey,
            },
        });
    }

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
