import elastic, {Client} from "@elastic/elasticsearch";
import {ConnectionOptions as TlsConnectionOptions} from "node:tls";

import {exists, readFile, readJSON} from "../utiles/fs";
import {PromiseDelayed} from "../utiles/promise";

export type AggregateName = elastic.estypes.AggregateName;
export type AggregationsAggregate = elastic.estypes.AggregationsAggregate;
export type BulkOperationContainer = elastic.estypes.BulkOperationContainer;
export type BulkOperationType = elastic.estypes.BulkOperationType;
export type BulkRequest = elastic.estypes.BulkRequest;
export type BulkResponse = elastic.estypes.BulkResponse;
export type BulkResponseItem = elastic.estypes.BulkResponseItem;
export type BulkUpdateAction<T, K> = elastic.estypes.BulkUpdateAction<T, K>;
export type ClearScrollRequest = elastic.estypes.ClearScrollRequest;
export type ClearScrollResponse = elastic.estypes.ClearScrollResponse;
export type ClosePointInTimeRequest = elastic.estypes.ClosePointInTimeRequest;
export type ClosePointInTimeResponse = elastic.estypes.ClosePointInTimeResponse;
export type CountRequest = elastic.estypes.CountRequest;
export type CountResponse = elastic.estypes.CountResponse;
export type DeleteByQueryRequest = elastic.estypes.DeleteByQueryRequest;
export type DeleteByQueryResponse = elastic.estypes.DeleteByQueryResponse;
export type DeleteRequest = elastic.estypes.DeleteRequest;
export type DeleteResponse = elastic.estypes.DeleteResponse;
export type GetRequest = elastic.estypes.GetRequest;
export type GetResponse<T> = elastic.estypes.GetResponse<T>;
export type IndexRequest = elastic.estypes.IndexRequest;
export type IndexResponse = elastic.estypes.IndexResponse;
export type IndicesCreateRequest = elastic.estypes.IndicesCreateRequest;
export type IndicesCreateResponse = elastic.estypes.IndicesCreateResponse;
export type IndicesDeleteRequest = elastic.estypes.IndicesDeleteRequest;
export type IndicesDeleteResponse = elastic.estypes.IndicesDeleteResponse;
export type IndicesExistsAliasRequest = elastic.estypes.IndicesExistsAliasRequest;
export type IndicesExistsAliasResponse = elastic.estypes.IndicesExistsAliasResponse;
export type IndicesExistsRequest = elastic.estypes.IndicesExistsRequest;
export type IndicesExistsResponse = elastic.estypes.IndicesExistsResponse;
export type IndicesForcemergeRequest = elastic.estypes.IndicesForcemergeRequest;
export type IndicesForcemergeResponse = elastic.estypes.IndicesForcemergeResponse;
export type IndicesGetAliasRequest = elastic.estypes.IndicesGetAliasRequest;
export type IndicesGetAliasResponse = elastic.estypes.IndicesGetAliasResponse;
export type IndicesGetRequest = elastic.estypes.IndicesGetRequest;
export type IndicesGetResponse = elastic.estypes.IndicesGetResponse;
export type IndicesUpdateAliasesAction = elastic.estypes.IndicesUpdateAliasesAction;
export type IndicesUpdateAliasesRequest = elastic.estypes.IndicesUpdateAliasesRequest;
export type IndicesUpdateAliasesResponse = elastic.estypes.IndicesUpdateAliasesResponse;
export type InfoRequest = elastic.estypes.InfoRequest;
export type InfoResponse = elastic.estypes.InfoResponse;
export type OpenPointInTimeRequest = elastic.estypes.OpenPointInTimeRequest;
export type OpenPointInTimeResponse = elastic.estypes.OpenPointInTimeResponse;
export type QueryDslQueryContainer = elastic.estypes.QueryDslQueryContainer;
export type ReindexRequest = elastic.estypes.ReindexRequest;
export type ReindexResponse = elastic.estypes.ReindexResponse;
export type Script = elastic.estypes.Script;
export type ScrollRequest = elastic.estypes.ScrollRequest;
export type ScrollResponse<T> = elastic.estypes.ScrollResponse<T>;
export type SearchCompletionSuggestOption<T> = elastic.estypes.SearchCompletionSuggestOption<T>;
export type SearchHit<T> = elastic.estypes.SearchHit<T>;
export type SearchPhraseSuggestOption = elastic.estypes.SearchPhraseSuggestOption;
export type SearchRequest = elastic.estypes.SearchRequest;
export type SearchTotalHits = elastic.estypes.SearchTotalHits;
export type SortResults = elastic.estypes.SortResults;
export type SearchResponse<T, K> = elastic.estypes.SearchResponse<T, K>;
export type SearchSuggest<T> = elastic.estypes.SearchSuggest<T>;
export type SearchTermSuggestOption = elastic.estypes.SearchTermSuggestOption;
export type Sort = elastic.estypes.Sort;
export type SuggestionName = elastic.estypes.SuggestionName;
export type UpdateByQueryRequest = elastic.estypes.UpdateByQueryRequest;
export type UpdateByQueryResponse = elastic.estypes.UpdateByQueryResponse;
export type UpdateRequest = elastic.estypes.UpdateRequest;
export type UpdateResponse<T> = elastic.estypes.UpdateResponse<T>;

export type ESAggregate = Record<AggregateName, AggregationsAggregate>;
export type ESSuggest<T> = Record<SuggestionName, SearchSuggest<T>[]>;
export type ESSuggestOption<T> = SearchPhraseSuggestOption|SearchTermSuggestOption|SearchCompletionSuggestOption<T>;
export type ESBulkOperation<TDocument=void> = (BulkOperationContainer | BulkUpdateAction<TDocument, Partial<TDocument>> | TDocument);
export type ESBulkResponse = Partial<Record<BulkOperationType, BulkResponseItem>>;

export interface IElasticSearch {
    hosts: string[];
    caFingerprint: string;
    user: string;
    password: string;
}

export interface IMetadata {
    index: string;
    id?: string;
    version?: number;
}

export interface IESConfig {
    credenciales: string;
    ca?: string;
}

export class Elasticsearch {
    protected cliente: Promise<Client>;

    public constructor(protected config: IESConfig) {
        this.cliente = this.load();

        // esto se hace por seguridad
        this.cliente.then(()=>{}).catch(()=>{});
    }

    private async load(): Promise<Client> {
        return this.loadConfig()
            // .catch(err=>{console.log(err);return Promise.reject(err);})
            // .catch(()=>null);
            .catch(()=>Promise.reject("Elastic not enabled"));
    }

    public async clearScroll(params: ClearScrollRequest): Promise<ClearScrollResponse> {
        const cliente = await this.cliente;
        return cliente.clearScroll(params);
    }

    public async delete(params: DeleteRequest): Promise<DeleteResponse> {
        const cliente = await this.cliente;
        return cliente.delete(params);
    }

    public async scroll<T>(params: ScrollRequest): Promise<ScrollResponse<T>> {
        const cliente = await this.cliente;
        return cliente.scroll<T>(params);
    }

    public async search<T, K extends ESAggregate = ESAggregate>(params: SearchRequest): Promise<SearchResponse<T, K>> {
        const cliente = await this.cliente;
        return cliente.search<T, K>(params);
    }

    public async get<T>(params: GetRequest): Promise<GetResponse<T>> {
        const cliente = await this.cliente;
        return cliente.get(params, {
            // ignore: [404],
        });
    }

    public async index(params: IndexRequest): Promise<IndexResponse> {
        const cliente = await this.cliente;
        return cliente.index(params);
    }

    public async reindex(params: ReindexRequest): Promise<ReindexResponse> {
        const cliente = await this.cliente;
        return cliente.reindex(params);
    }

    public async update<T>(params: UpdateRequest): Promise<UpdateResponse<T>> {
        const cliente = await this.cliente;
        return cliente.update(params);
    }

    public async openPointInTime(params: OpenPointInTimeRequest): Promise<OpenPointInTimeResponse> {
        const cliente = await this.cliente;
        return cliente.openPointInTime(params);
    }

    public async closePointInTime(params: ClosePointInTimeRequest): Promise<ClosePointInTimeResponse> {
        const cliente = await this.cliente;
        return cliente.closePointInTime(params);
    }

    public async deleteByQuery(params: DeleteByQueryRequest): Promise<DeleteByQueryResponse> {
        const cliente = await this.cliente;
        return cliente.deleteByQuery(params);
    }

    public async updateByQuery(params: UpdateByQueryRequest): Promise<UpdateByQueryResponse> {
        const cliente = await this.cliente;
        return cliente.updateByQuery(params);
    }

    public async count(params: CountRequest): Promise<CountResponse> {
        const cliente = await this.cliente;
        return cliente.count(params);
    }

    public async bulk(params: BulkRequest): Promise<BulkResponse> {
        const cliente = await this.load();
        return cliente.bulk(params);
    }

    public async info(params: InfoRequest = {}): Promise<InfoResponse> {
        const cliente = await this.cliente;
        return cliente.info(params);
    }

    public async indicesCreate(params: IndicesCreateRequest): Promise<IndicesCreateResponse> {
        const cliente = await this.cliente;
        return cliente.indices.create(params);
    }

    public async indicesDelete(params: IndicesDeleteRequest): Promise<IndicesDeleteResponse> {
        const cliente = await this.cliente;
        return cliente.indices.delete(params);
    }

    public async indicesExists(params: IndicesExistsRequest): Promise<IndicesExistsResponse> {
        const cliente = await this.cliente;
        return cliente.indices.exists(params);
    }

    public async indicesExistsAlias(params: IndicesExistsAliasRequest): Promise<IndicesExistsAliasResponse> {
        const cliente = await this.cliente;
        return cliente.indices.existsAlias(params);
    }

    public async indicesForcemerge(params: IndicesForcemergeRequest): Promise<IndicesForcemergeResponse> {
        const cliente = await this.cliente;
        return cliente.indices.forcemerge(params);
    }

    public async indicesGet(params: IndicesGetRequest): Promise<IndicesGetResponse> {
        const cliente = await this.cliente;
        return cliente.indices.get(params);
    }

    public async indicesGetAlias(params: IndicesGetAliasRequest): Promise<IndicesGetAliasResponse> {
        const cliente = await this.cliente;
        return cliente.indices.getAlias(params);
    }

    public async indicesUpdateAliases(params: IndicesUpdateAliasesRequest): Promise<IndicesUpdateAliasesResponse> {
        const cliente = await this.cliente;
        return cliente.indices.updateAliases(params);
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

    protected async loadConfig(): Promise<Client> {
        if (!await exists(this.config.credenciales)) {
            return Promise.reject("Elastic disabled");
        }
        const config: IElasticSearch = await readJSON<IElasticSearch>(this.config.credenciales);

        let tls: TlsConnectionOptions|undefined;
        if (this.config.ca!=undefined) {
            if (!PRODUCCION) {
                if (await exists(this.config.ca)) {
                    tls = {
                        ca: await readFile(this.config.ca),
                        rejectUnauthorized: true,
                    };
                } else {
                    tls = {
                        rejectUnauthorized: false,
                    };
                }
            } else {
                if (await exists(this.config.ca)) {
                    tls = {
                        ca: await readFile(this.config.ca),
                        rejectUnauthorized: true,
                    };
                }
            }
        }

        return new Client({
            nodes: config.hosts,
            auth: {
                username: config.user,
                password: config.password,
            },
            compression: !config.hosts.map(actual=>actual.startsWith("https://")).reduce((actual, acumulado)=>actual||acumulado),
            tls,
            requestTimeout: 60000,
        });
    }
}
