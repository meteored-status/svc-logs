/**
 * Editor: Bixus
 * Fecha: Wed, 23 Sep 2026 08:46:26 GMT
 * Hash: ecab17d7f5f6760d40b618e1d7f4ada2
 * Versión: 2026.9.23+3-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

import type {IMetadata, ISend} from "./send";
import {Send, TSend} from "./send";
import type {IMail} from "../../../email/manager";

export interface ISparkpostSend extends ISend {
    email?: IMail;
    transmissionId?: string;
}

export class SparkpostSend extends Send {
    /* INSTANCE */
    public constructor(data: ISparkpostSend, metadata: IMetadata) {
        super(data, metadata);
    }

    public get email(): IMail | undefined {
        return this.data.email;
    }

    public get transmissionId(): string | undefined {
        return this.data.transmissionId;
    }

    public set transmissionId(value: string | undefined) {
        this.data.transmissionId = value;
    }

    protected override get data(): ISparkpostSend {
        return super.data as ISparkpostSend;
    }

    /* STATIC */
    public static create(sendTask: number, expires: Date, scheduled: Date, mail: IMail): SparkpostSend {
        const data = this.buildData(TSend.SPARKPOST, sendTask, expires, scheduled);
        return new SparkpostSend({
            ...data,
            email: mail
        }, {});
    }

}
