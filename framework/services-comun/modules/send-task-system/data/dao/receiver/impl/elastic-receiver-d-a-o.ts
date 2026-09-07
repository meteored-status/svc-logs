/**
 * Editor: Juan C. Martínez
 * Fecha: Thu, 03 Sep 2026 13:36:43 GMT
 * Hash: 5871bee4dac7d0603dbf632b779267e9
 * Versión: 2026.9.3+3-juancmartinez
 * Proyecto: git@github.com:alpred/meteored-svc-newsletter.git
 */

import {ReceiverDAO} from "../receiver-d-a-o";
import {ElasticSearch} from "../../../../utiles/config";
import {Elasticsearch, SearchHit, SearchRequest, SortResults} from "../../../../../elasticsearch";
import {Receiver} from "../../../model/receiver";
import {ElasticSearchBulk, ElasticSearchBulkConfig} from "../../../../../database/bulk/elastic";
import {ElasticSearchScroll} from "../../../../../database/scroll";
import type {TBounceCategory} from "../../../../../email/webhook/sparkpost/bounce-class";

interface IDocument {
    id: string;
    send_id: string;
    send_task_id: number;
    send_task_instance_id: string;
    created: Date;
    statistics?: IStatistics;
}

/**
 * Estadísticas acumuladas de un receptor, a partir de los eventos del proveedor.
 *
 * @property received     - El mensaje llegó al buzón. Un rebote asíncrono lo retira: ver
 *                          `undelivered`.
 * @property received_time- Cuándo lo aceptó el MTA remoto. Se conserva aunque `received` se retire,
 *                          porque la aceptación ocurrió de verdad.
 * @property bounce       - Llegó algún evento de rebote, de cualquier naturaleza. **No sirve por sí
 *                          solo como tasa de rebote**: la mayoría son direcciones ya suprimidas.
 *                          Los rebotes reales son `bounce && !suppressed`.
 * Los cuatro campos de rebote van opcionales a propósito: no hay recálculo hacia atrás, así que los
 * receptores indexados antes de este cambio no los tienen. Ausente significa «no se sabe», no
 * «no» — pero como `undefined` es falsy, un consumidor que pregunte `!suppressed` los trata como no
 * suprimidos, que es lo prudente.
 *
 * @property suppressed   - El proveedor no llegó a enviar porque la dirección está en su lista de
 *                          supresión (`bounce_class` 25). Es secuela de un rebote antiguo, no uno
 *                          nuevo.
 * @property undelivered  - Un rebote `out_of_band` retiró la recepción: el MTA aceptó el mensaje y
 *                          lo devolvió después. Las autorespuestas de ausencia no cuentan.
 * @property bounce_class - Clase de rebote de Sparkpost del último rebote registrado.
 * @property bounce_category - Categoría derivada de `bounce_class`.
 */
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
    suppressed?: boolean;
    undelivered?: boolean;
    bounce_class?: number;
    bounce_category?: TBounceCategory;
}

export class ElasticReceiverDAO extends ReceiverDAO {
    /* INSTANCE */
    public constructor(private readonly config: ElasticSearch, private readonly client: Elasticsearch) {
        super();
    }

    // public static getAlias(config: ElasticSearch): string {
    //     const suffix: string = PRODUCCION ? (TEST ? 'test' : 'produccion') : 'desarrollo';
    //     return `${config.receiverIndex}-${suffix}`;
    // }
    //
    // public static getIndex(config: ElasticSearch): string {
    //     return `${this.getAlias(config)}-${Fecha.generarMarcaMes()}`;
    // }

    public override async save(receiver: Receiver): Promise<Receiver> {
        const data = this.receiverToDocument(receiver);
        await this.client.index({
            index: this.config.receiverIndex,//ElasticReceiverDAO.getIndex(this.config),
            document: {
                "@timestamp": data.created,
                ...data
            }
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
            request.index = this.config.receiverIndex;//ElasticReceiverDAO.getAlias(this.config);
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
            scroll.control = salida.hits.hits[salida.hits.hits.length - 1]?.sort as SortResults | undefined;
        }

        return salida.hits.hits.map(hit => this.documentToReceiver(hit));
    }

    public override async createBulk(config?: ElasticSearchBulkConfig): Promise<ElasticSearchBulk> {
        return new ElasticSearchBulk(this.client, {
            chunk: config?.chunk || 1000,
            waitToSave: config?.waitToSave,
            getIndex: (obj: Receiver) => obj.metadata.index!,
            getId: (obj: Receiver) => obj.metadata.id!,
            getData: (obj: Receiver) => this.receiverToDocument(obj)
        });
    }

    public override async createScroll(): Promise<ElasticSearchScroll> {
        const pit = await this.client.openPointInTime({
            index: this.config.receiverIndex,//ElasticReceiverDAO.getAlias(this.config),
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
