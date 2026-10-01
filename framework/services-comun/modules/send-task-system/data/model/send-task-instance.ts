/**
 * Editor: Bixus
 * Fecha: Wed, 23 Sep 2026 08:46:26 GMT
 * Hash: 07a263e292cef8c4d415232fb50ade90
 * Versión: 2026.9.23+3-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

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

    /* STATIC */

    public static create(sendTask: number): SendTaskInstance {
        return new SendTaskInstance({
            id: md5(`${sendTask}-${Date.now()}`),
            created: new Date(),
            sendTaskId: sendTask
        });
    }
}
