export interface ISendSchedule {
    id?: number;
    sendTask: number;
    sendDate: Date;
}

export class SendSchedule {
    /* STATIC */

    /* INSTANCE */
    public constructor(private readonly _data: ISendSchedule) {
    }

    private get data(): ISendSchedule {
        return this._data;
    }

    public get id(): number | undefined {
        return this.data.id;
    }

    public get sendTask(): number {
        return this.data.sendTask;
    }

    public get sendDate(): Date {
        return this.data.sendDate;
    }

    public set sendDate(value: Date) {
        this.data.sendDate = value;
    }
}
