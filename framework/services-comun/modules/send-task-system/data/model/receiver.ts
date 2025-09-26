export interface IReceiver {
    id: string;
    sendId: string;
    sendTaskId: number;
    sendTaskInstanceId: string;
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
