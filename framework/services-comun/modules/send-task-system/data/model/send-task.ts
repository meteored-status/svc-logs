/**
 * Editor: Bixus
 * Fecha: Wed, 23 Sep 2026 08:46:26 GMT
 * Hash: 5bd7b397084f6bf26100b042466a26b7
 * Versión: 2026.9.23+3-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

export enum TSendTaskStatus {
    ACTIVE = 1,
    INACTIVE = 2
}

export enum TSendTaskType {
    NEWSLETTER = 1,
    LOCATION
}

export interface ISendTask {
    id?: number;
    status: TSendTaskStatus;
    start_validity: Date;
    end_validity?: Date;
    type: TSendTaskType;
}

export class SendTask {
    /* INSTANCE */
    public constructor(private readonly _data: ISendTask) {
    }

    private get data(): ISendTask {
        return this._data;
    }

    public get id(): number|undefined {
        return this.data.id;
    }

    public get status(): TSendTaskStatus {
        return this.data.status;
    }

    public set status(value: TSendTaskStatus) {
        this.data.status = value;
    }

    public get start_validity(): Date {
        return this.data.start_validity;
    }

    public set start_validity(value: Date) {
        this.data.start_validity = value;
    }

    public get end_validity(): Date|undefined {
        return this.data.end_validity;
    }

    public set end_validity(value: Date|undefined) {
        this.data.end_validity = value;
    }

    public get type(): TSendTaskType {
        return this.data.type;
    }

    public set type(value: TSendTaskType) {
        this.data.type = value;
    }
}
