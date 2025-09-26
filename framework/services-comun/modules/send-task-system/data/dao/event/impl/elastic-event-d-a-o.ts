import {EventDAO, Search} from "../event-d-a-o";
import {ElasticSearch} from "../../../../utiles/config";
import {Fecha} from "../../../../../utiles/fecha";
import {
    Elasticsearch,
    QueryDslQueryContainer,
    SearchRequest,
    SearchResponse,
    SortResults
} from "../../../../../elasticsearch";
import {ISendEvent, SendEvent, TEvent} from "../../../model/send-event";
import {SparkpostEvent} from "../../../model/sparkpost-event";
import {ElasticSearchScroll} from "../../../../../database/scroll";

interface IDocument {
    type: TEvent;
    send_id: string;
    created: Date;
    received: Date;
    json_event: string;
    receiver: string;
}

export class ElasticEventDAO extends EventDAO {
    /* INSTANCE */
    public constructor(private readonly config: ElasticSearch, private readonly client: Elasticsearch) {
        super();
    }

    /* STATIC */
    public static getAlias(config: ElasticSearch): string {
        const suffix: string = PRODUCCION ? (TEST ? 'test' : 'produccion') : 'desarrollo';
        return `${config.eventIndex}-${suffix}`;
    }

    public static getIndex(config: ElasticSearch): string {
        return `${this.getAlias(config)}-${Fecha.generarMarcaMes()}`;
    }

    public override async save(event: SendEvent): Promise<SendEvent> {
        await this.client.index({
            index: ElasticEventDAO.getIndex(this.config),
            document: this.eventToDocument(event)
        });

        return event;
    }

    public override async createScroll(): Promise<ElasticSearchScroll> {
        const pit = await this.client.openPointInTime({
            index: ElasticEventDAO.getAlias(this.config),
            keep_alive: "5m"
        });

        return new ElasticSearchScroll(pit.id, async () => {
            await this.client.closePointInTime({
                id: pit.id
            });
        });
    }

    public override async search(options: Search, scroll?: ElasticSearchScroll): Promise<SendEvent[]> {

        const must: QueryDslQueryContainer[] = [];

        const request: SearchRequest = {
            size: options.size
        }

        if (!scroll) {
            request.index = ElasticEventDAO.getAlias(this.config);
        }

        if (options.created) {
            must.push({
                range: {
                    created: {
                        gte: options.created.from,
                        lte: options.created.to
                    }
                }
            });
        }

        request.query = {
            bool: {
                must
            }
        };

        if (scroll) {
            request.pit = {
                id: scroll.id,
                keep_alive: "5m"
            };

            request.sort = [
                {
                    created: "asc",
                }
            ];

            if (scroll.control) {
                request.search_after = scroll.control;
            }
        }

        const resultEvents: SearchResponse<IDocument, any> = await this.client.search<IDocument>(request);

        if (scroll) {
            scroll.control = resultEvents.hits.hits[resultEvents.hits.hits.length - 1]?.sort as SortResults;
        }

        return resultEvents.hits.hits.map(hit => this.documentToEvent(hit._source!));
    }

    private eventToDocument(event: SendEvent): IDocument {
        if (event.sendId == null) {
            throw new Error('El evento debe tener un sendId');
        }

        const base: IDocument = {
            type: event.type,
            send_id: event.sendId,
            created: event.created,
            received: event.received,
            json_event: "",
            receiver: event.receiver,
        }

        switch (event.type) {
            case TEvent.SPAKPOST:
                return {
                    ...base,
                    json_event: JSON.stringify((event as SparkpostEvent).messageData),
                };
        }

    }

    private documentToEvent(doc: IDocument): SendEvent {
        const data: ISendEvent = {
            sendId: doc.send_id,
            created: new Date(doc.created),
            received: new Date(doc.received),
            receiver: doc.receiver,
            type: doc.type,
        }

        switch (doc.type) {
            case TEvent.SPAKPOST:
                return new SparkpostEvent({
                    ...data,
                    messageData: JSON.parse(doc.json_event)
                });
        }

    }
}
