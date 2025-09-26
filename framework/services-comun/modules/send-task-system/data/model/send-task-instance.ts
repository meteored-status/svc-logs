import {md5} from "../../../utiles/hash";

export interface ISendTaskInstance {
    id: string;
    created: Date;
    sendTaskId: number;
}

export class SendTaskInstance {
    /* STATIC */

    /* INSTANCE */
    public constructor(private readonly _data: ISendTaskInstance) {
    }

    public get id(): string {
        return this.data.id;
    }

    public get created(): Date {
        return this.data.created;
    }

    private get data(): ISendTaskInstance {
        return this._data;
    }

    public static create(sendTask: number): SendTaskInstance {
        return new SendTaskInstance({
            id: md5(`${sendTask}-${Date.now()}`),
            created: new Date(),
            sendTaskId: sendTask
        });
    }
}
