import {ReceiverDAO} from "../receiver-d-a-o";
import {ElasticSearch} from "../../../../utiles/config";
import {Fecha} from "../../../../../utiles/fecha";
import {Elasticsearch, SearchHit, SearchRequest, SortResults} from "../../../../../elasticsearch";
import {Receiver} from "../../../model/receiver";
import {ElasticSearchBulk, ElasticSearchBulkConfig} from "../../../../../database/bulk/elastic";
import {ElasticSearchScroll} from "../../../../../database/scroll";

interface IDocument  {
    id: string;
    send_id: string;
    send_task_id: number;
    send_task_instance_id: string;
    created: Date;
    statistics?: IStatistics;
}

export interface IStatistics {
    received_time?: number;
    first_open_time?: number;
    times_opened: number;
    times_clicked: number;
    time_until_open: number;
    updated: number;
    received: boolean;
    bounce: boolean;
    spam: boolean;
    unsubscribe: boolean;
    first_open_count: number;
    bounce_count: number;
    unsubscribe_count: number;
    spam_count: number;
}

export class ElasticReceiverDAO extends ReceiverDAO {
    public static getAlias(config: ElasticSearch): string {
        const suffix: string = PRODUCCION ? (TEST ? 'test' : 'produccion'): 'desarrollo';
        return `${config.receiverIndex}-${suffix}`;
    }

    public static getIndex(config: ElasticSearch): string {
        return `${this.getAlias(config)}-${Fecha.generarMarcaMes()}`;
    }

    /* INSTANCE */
    public constructor(private readonly config: ElasticSearch, private readonly client: Elasticsearch) {
        super();
    }

    public override async save(receiver: Receiver): Promise<Receiver> {
        await this.client.index({
            index: ElasticReceiverDAO.getIndex(this.config),
            document: this.receiverToDocument(receiver)
        });

        return receiver;
    }

    public override async getBySendIds(sendIds: string[], scroll?: ElasticSearchScroll): Promise<Receiver[]> {
        const request: SearchRequest = {
            size: 1000,
            query: {
                terms: {
                    send_id: sendIds
                }
            }
        }

        if (!scroll) {
            request.index = ElasticReceiverDAO.getAlias(this.config);
        }

        if (scroll) {
            request.pit = {
                id: scroll.id,
                keep_alive: "5m"
            };

            request.sort = [
                {
                    send_task_id: "asc",
                }
            ];

            if (scroll.control) {
                request.search_after = scroll.control;
            }
        }


        const salida = await this.client.search<IDocument>(request);

        if (scroll) {
            scroll.control = salida.hits.hits[salida.hits.hits.length - 1]?.sort as SortResults|undefined;
        }

        return salida.hits.hits.map(hit => this.documentToReceiver(hit));
    }

    public override async createBulk(config?: ElasticSearchBulkConfig): Promise<ElasticSearchBulk> {
        return new ElasticSearchBulk(this.client, {
            chunk: config?.chunk||1000,
            waitToSave: config?.waitToSave,
            getIndex: (obj: Receiver) => obj.metadata.index!,
            getId: (obj: Receiver) => obj.metadata.id!,
            getData: (obj: Receiver) => this.receiverToDocument(obj)
        });
    }

    public override async createScroll(): Promise<ElasticSearchScroll> {
        const pit = await this.client.openPointInTime({
            index: ElasticReceiverDAO.getAlias(this.config),
            keep_alive: "5m"
        });

        return new ElasticSearchScroll(pit.id, async () => {
            await this.client.closePointInTime({
                id: pit.id
            });
        });
    }

    private receiverToDocument(receiver: Receiver): IDocument {
        return {
            id: receiver.id,
            send_id: receiver.sendId,
            send_task_id: receiver.sendTaskId,
            send_task_instance_id: receiver.sendTaskInstanceId,
            created: receiver.created,
            statistics: receiver.statistics
        }
    }

    private documentToReceiver(hit: SearchHit<IDocument>): Receiver {
        const document = hit._source!;
        return new Receiver({
            id: document.id,
            sendId: document.send_id,
            sendTaskId: document.send_task_id,
            sendTaskInstanceId: document.send_task_instance_id,
            created: new Date(document.created),
            statistics: document.statistics
        }, {
            id: hit._id,
            index: hit._index
        });
    }
}
