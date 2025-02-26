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
    /* STATIC */

    /* INSTANCE */
    public constructor(private readonly _data: ISendEvent) {
    }

    protected get data(): ISendEvent {
        return this._data;
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

    public get sendId(): string|undefined {
        return this.data.sendId;
    }

    public set sendId(value: string) {
        this.data.sendId = value;
    }

}
