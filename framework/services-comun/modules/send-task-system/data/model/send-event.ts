/**
 * Editor: Bixus
 * Fecha: Wed, 23 Sep 2026 08:46:26 GMT
 * Hash: ac27f7fe4616677dd4654523d4a53e66
 * Versión: 2026.9.23+3-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

export enum TEvent {
    SPAKPOST = 1,
}

export interface ISendEvent {
    type: TEvent;
    created: Date;
    received: Date;
    receiver: string;
    sendId?: string;
}

export abstract class SendEvent {
    /* INSTANCE */
    public constructor(private readonly _data: ISendEvent) {
    }

    public get type(): TEvent {
        return this.data.type;
    }

    public get created(): Date {
        return this.data.created;
    }

    public get received(): Date {
        return this.data.received;
    }

    public get receiver(): string {
        return this.data.receiver;
    }

    public get sendId(): string | undefined {
        return this.data.sendId;
    }

    public set sendId(value: string) {
        this.data.sendId = value;
    }

    protected get data(): ISendEvent {
        return this._data;
    }

}
