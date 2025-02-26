import {md5} from "../../../utiles/hash";

export interface ISendTaskInstance {
    id: string;
    created: Date;
    sendTaskId: number;
}

export class SendTaskInstance {
    /* STATIC */

    public static create(sendTask: number): SendTaskInstance {
        return new SendTaskInstance({
            id: md5(`${sendTask}-${Date.now()}`),
            created: new Date(),
            sendTaskId: sendTask
        });
    }

    /* INSTANCE */
    public constructor(private readonly _data: ISendTaskInstance) {
    }

    private get data(): ISendTaskInstance {
        return this._data;
    }

    public get id(): string {
        return this.data.id;
    }

    public get created(): Date {
        return this.data.created;
    }
}
