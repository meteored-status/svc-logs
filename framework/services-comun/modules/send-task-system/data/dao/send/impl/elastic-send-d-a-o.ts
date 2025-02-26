import {SendDAO} from "../send-d-a-o";
import {Elasticsearch} from "../../../../../elasticsearch";
import {Send, TSend, TStatus} from "../../../model/send";
import {ElasticSearch} from "../../../../utiles/config";
import {Fecha} from "../../../../../utiles/fecha";
import {SparkpostSend} from "../../../model/sparkpost-send";

interface IDocument {
    id: string;
    type: TSend;
    status: TStatus;
    created: Date;
    expiration: Date;
    programmed_send: Date;
    tries: number;
    send_task_id: number;
    send_task_instance_id?: string;
    content?: any;
    transmission_id?: string;
}

declare var PRODUCCION: boolean;
declare var TEST: boolean;

export class ElasticSendDAO extends SendDAO {
    /* STATIC */
    public static getAlias(config: ElasticSearch): string {
        const suffix: string = PRODUCCION ? (TEST ? 'test' : 'produccion'): 'desarrollo';
        return `${config.sendIndex}-${suffix}`;
    }

    public static getIndex(config: ElasticSearch): string {
        return `${this.getAlias(config)}-${Fecha.generarMarcaMes()}`;
    }

    /* INSTANCE */
    public constructor(private readonly config: ElasticSearch, private readonly client: Elasticsearch) {
        super();
    }

    public override async save(send: Send): Promise<Send> {
        if (send.metadata.id && send.metadata.index) {
            await this.client.update({
                id: send.metadata.id,
                index: send.metadata.index,
                doc: this.sendToDocument(send)
            });
        } else {
            const response = await this.client.index({
                index: ElasticSendDAO.getIndex(this.config),
                document: this.sendToDocument(send)
            });

            send.metadata.id = response._id;
            send.metadata.index = response._index;
        }
        return send;
    }

    public override async getPending(): Promise<Send[]> {
        const data = await this.client.search<IDocument>({
            index: ElasticSendDAO.getIndex(this.config),
            query: {
                bool: {
                    must: [
                        {
                            term: {
                                status: TStatus.PENDING
                            }
                        }
                    ]
                }
            }
        });

        return data.hits.hits.map(hit => {
            const source = hit._source!;
            switch (source.type) {
                case TSend.SPARKPOST:
                    return this.documentToSend(source, {id: hit._id!, index: hit._index});
            }
        });
    }

    public override async findByTransmissionId(transmissionId: string): Promise<Send> {
        const data = await this.client.search<IDocument>({
            index: ElasticSendDAO.getIndex(this.config),
            query: {
                bool: {
                    must: [
                        {
                            term: {
                                transmission_id: transmissionId
                            }
                        }
                    ]
                }
            }
        });

        if (data.hits.hits.length === 0) {
            throw new Error(`No se encontró el envío con transmission_id: ${transmissionId}`);
        }

        const hit = data.hits.hits[0];
        const source = hit._source!;
        switch (source.type) {
            case TSend.SPARKPOST:
                return this.documentToSend(source, {id: hit._id!, index: hit._index});
        }
    }

    private sendToDocument(send: Send): IDocument {
        const base: IDocument = {
            id: send.id,
            type: send.type,
            status: send.status,
            created: send.created,
            expiration: send.expiration,
            programmed_send: send.programmedSend,
            tries: send.tries,
            send_task_id: send.sendTaskId,
            send_task_instance_id: send.sendTaskInstanceId,
            content: send.content
        };

        switch (send.type) {
            case TSend.SPARKPOST:
                return {
                    ...base,
                    transmission_id: (send as SparkpostSend).transmissionId
                }
        }
    }

    private documentToSend(document: IDocument, metadata: {id: string, index: string}): Send {
        switch (document.type) {
            case TSend.SPARKPOST:
                return new SparkpostSend({
                    id: document.id,
                    type: document.type,
                    status: document.status,
                    created: new Date(document.created),
                    expiration: new Date(document.expiration),
                    programmed_send: new Date(document.programmed_send),
                    tries: document.tries,
                    send_task_id: document.send_task_id,
                    send_task_instance_id: document.send_task_instance_id,
                    content: document.content,
                    transmissionId: document.transmission_id
                }, metadata);
        }
    }
}
