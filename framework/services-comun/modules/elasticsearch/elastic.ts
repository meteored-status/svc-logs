import {
    BulkResponse as BulkResponseBase,
    GetResponse as GetResponseBase,
    IndexResponse as IndexResponseBase,
    IndicesExistsResponse as IndicesExistsResponseBase,
    InfoResponse as InfoResponseBase,
    ScrollResponse as ScrollResponseBase,
    SearchResponse as SearchResponseBase,
    UpdateResponse as UpdateResponseBase,
} from "@elastic/elasticsearch/lib/api/types";
import {Client} from "@elastic/elasticsearch";
import {ConnectionOptions as TlsConnectionOptions} from 'node:tls';

import {
    Elasticsearch as ElasticsearchBase,
    ESAggregate as ESAggregateBase,
    ESSuggest as ESSuggestBase,
    ESSuggestOption as ESSuggestOptionBase,
    IElasticSearch,
    IMetadata as IMetadataBase,
} from "./base";
import {exists, readFile, readJSON} from "../utiles/fs";

declare var PRODUCCION: boolean;

export interface BulkResponse extends BulkResponseBase {}
export interface ESAggregate extends ESAggregateBase {}
export interface ESSuggest<T> extends ESSuggestBase<T> {}
export type ESSuggestOption<T> = ESSuggestOptionBase<T>;
export interface GetResponse extends GetResponseBase {}
export interface IMetadata extends IMetadataBase {}
export interface IndexResponse extends IndexResponseBase {}
export type IndicesExistsResponse = IndicesExistsResponseBase;
export interface InfoResponse extends InfoResponseBase {}
export interface ScrollResponse extends ScrollResponseBase {}
export interface SearchResponse<T, K> extends SearchResponseBase<T, K> {}
export interface UpdateResponse extends UpdateResponseBase {}


class Elasticsearch extends ElasticsearchBase {
    public constructor() {
        super();
    }

    protected async loadConfig(): Promise<Client> {
        const file = "files/credenciales/elastic.json";
        if (!await exists(file)) {
            return Promise.reject("Elastic disabled");
        }
        const config: IElasticSearch = await readJSON<IElasticSearch>(file);

        const ca = "files/ssl/elastic-ca.crt";
        let tls: TlsConnectionOptions|undefined;
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
        } else {
            if (await exists(ca)) {
                tls = {
                    ca: await readFile(ca),
                    rejectUnauthorized: true,
                };
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
        });
    }
}

const elasticsearch = new Elasticsearch();

export default elasticsearch;
