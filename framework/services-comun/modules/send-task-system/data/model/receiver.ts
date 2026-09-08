/**
 * Editor: Juan C. Martínez
 * Fecha: Thu, 03 Sep 2026 13:36:43 GMT
 * Hash: a963a0a4f7dbed0c712810c38a285fff
 * Versión: 2026.9.3+3-juancmartinez
 * Proyecto: git@github.com:alpred/meteored-svc-newsletter.git
 */

import type {TBounceCategory} from "../../../email/webhook/sparkpost/bounce-class";

export interface IReceiver {
    id: string;
    sendId: string;
    sendTaskId: number;
    sendTaskInstanceId: string;
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

export interface IMetadata {
    id?: string;
    index?: string;
}

export class Receiver {
    /* INSTANCE */
    public constructor(private readonly _data: IReceiver, public metadata: IMetadata) {
    }

    public get id(): string {
        return this.data.id;
    }

    public get sendId(): string {
        return this.data.sendId;
    }

    public get sendTaskId(): number {
        return this.data.sendTaskId;
    }

    public get sendTaskInstanceId(): string {
        return this.data.sendTaskInstanceId;
    }

    public get created(): Date {
        return this.data.created;
    }

    public get statistics(): IStatistics | undefined {
        return this.data.statistics;
    }

    public set statistics(statistics: IStatistics | undefined) {
        this.data.statistics = statistics;
    }

    private get data(): IReceiver {
        return this._data;
    }

    /* STATIC */
    public static create(id: string, sendId: string, sendTaskId: number, sendTaskInstanceId: string): Receiver {
        return new Receiver({
            id,
            sendId,
            sendTaskId,
            sendTaskInstanceId,
            created: new Date()
        }, {});
    }

}
