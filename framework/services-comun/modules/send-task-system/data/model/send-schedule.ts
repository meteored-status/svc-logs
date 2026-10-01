/**
 * Editor: Bixus
 * Fecha: Wed, 23 Sep 2026 08:46:26 GMT
 * Hash: 34267811764f14d5ff0a44f4a21b3689
 * Versión: 2026.9.23+3-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

export interface ISendSchedule {
    id?: number;
    sendTask: number;
    sendDate: Date;
}

export class SendSchedule {
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
