import {v7 as uuid} from "uuid";

export enum TStatus {
    SEND = 1,
    PENDING = 2,
    ERROR = 3,
}

export enum TSend {
    SPARKPOST = 1
}

export interface ISend {
    id: string;
    type: TSend;
    status: TStatus;
    created: Date;
    expiration: Date;
    programmed_send: Date;
    tries: number;
    send_task_id: number;
    send_task_instance_id?: string;
}

export interface IMetadata {
    id?: string;
    index?: string;
}

export abstract class Send {
    /* INSTANCE */
    protected constructor(private readonly _data: ISend, public metadata: IMetadata) {
    }

    public get id(): string {
        return this.data.id;
    }

    public get type(): TSend {
        return this.data.type;
    }

    public get status(): TStatus {
        return this.data.status;
    }

    public set status(value: TStatus) {
        this.data.status = value;
    }

    public get created(): Date {
        return this.data.created;
    }

    public get expiration(): Date {
        return this.data.expiration;
    }

    public get programmedSend(): Date {
        return this.data.programmed_send;
    }

    public get tries(): number {
        return this.data.tries;
    }

    public set tries(value: number) {
        this.data.tries = value;
    }

    public get sendTaskId(): number {
        return this.data.send_task_id;
    }

    public get sendTaskInstanceId(): string | undefined {
        return this.data.send_task_instance_id;
    }

    public set sendTaskInstanceId(value: string | undefined) {
        this.data.send_task_instance_id = value;
    }

    protected get data(): ISend {
        return this._data;
    }

    /* STATIC */
    protected static buildData(type: TSend, sendTaskId: number, expires: Date, scheduled: Date): ISend {
        return {
            id: uuid(),
            type,
            status: TStatus.PENDING,
            created: new Date(),
            expiration: expires,
            programmed_send: scheduled,
            tries: 0,
            send_task_id: sendTaskId
        }
    }
}
