import {
    AggregateName,
    AggregationsAggregate, BulkOperationType,
    BulkRequest,
    BulkResponse as BulkResponseBase,
    BulkResponseItem,
    ClearScrollRequest, ClearScrollResponse,
    ClosePointInTimeRequest,
    ClosePointInTimeResponse,
    CountRequest,
    CountResponse,
    DeleteByQueryRequest,
    DeleteByQueryResponse, DeleteRequest, DeleteResponse,
    GetRequest,
    GetResponse as GetResponseBase,
    IndexRequest,
    IndexResponse as IndexResponseBase,
    IndicesCreateRequest,
    IndicesCreateResponse,
    IndicesDeleteRequest,
    IndicesDeleteResponse,
    IndicesExistsAliasRequest,
    IndicesExistsAliasResponse,
    IndicesExistsRequest,
    IndicesExistsResponse as IndicesExistsResponseBase,
    IndicesForcemergeRequest,
    IndicesForcemergeResponse,
    IndicesGetAliasRequest,
    IndicesGetAliasResponse,
    IndicesGetRequest,
    IndicesGetResponse,
    IndicesUpdateAliasesRequest,
    IndicesUpdateAliasesResponse,
    InfoRequest,
    InfoResponse as InfoResponseBase,
    OpenPointInTimeRequest,
    OpenPointInTimeResponse, ReindexRequest, ReindexResponse,
    ScrollRequest,
    ScrollResponse as ScrollResponseBase,
    SearchCompletionSuggestOption,
    SearchPhraseSuggestOption,
    SearchRequest,
    SearchResponse as SearchResponseBase,
    SearchSuggest,
    SearchTermSuggestOption,
    SuggestionName, UpdateByQueryRequest, UpdateByQueryResponse,
    UpdateRequest,
    UpdateResponse as UpdateResponseBase,
} from "@elastic/elasticsearch/lib/api/types";
import {Client} from "@elastic/elasticsearch";

import {PromiseDelayed} from "../utiles/promise";

export interface BulkResponse extends BulkResponseBase {}
export interface GetResponse<T> extends GetResponseBase<T> {}
export interface IndexResponse extends IndexResponseBase {}
export type IndicesExistsResponse = IndicesExistsResponseBase;
export interface InfoResponse extends InfoResponseBase {}
export interface ScrollResponse<T> extends ScrollResponseBase<T> {}
export interface SearchResponse<T, K extends ESAggregate = ESAggregate> extends SearchResponseBase<T, K> {}
export interface UpdateResponse<T> extends UpdateResponseBase<T> {}

export type ESAggregate = Record<AggregateName, AggregationsAggregate>;
export type ESSuggest<T> = Record<SuggestionName, SearchSuggest<T>[]>;
export type ESSuggestOption<T> = SearchPhraseSuggestOption|SearchTermSuggestOption|SearchCompletionSuggestOption<T>;
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

export abstract class Elasticsearch {
    protected cliente: Promise<Client>;

    protected constructor() {
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

    protected abstract loadConfig(): Promise<Client>;
}
