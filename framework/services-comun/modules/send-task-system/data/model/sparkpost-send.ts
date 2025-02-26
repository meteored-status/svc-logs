import {IMetadata, ISend, Send, TSend} from "./send";
import {IMail} from "../../../email/manager";

export interface ISparkpostSend extends ISend {
    email?: IMail;
    transmissionId?: string;
}

export class SparkpostSend extends Send {
    /* STATIC */
    public static create(sendTask: number, expires: Date, scheduled: Date, mail: IMail): SparkpostSend {
        const data = this.buildData(TSend.SPARKPOST, sendTask, expires, scheduled);
        return new SparkpostSend({
            ...data,
            email: mail
        }, {});
    }

    /* INSTANCE */
    public constructor(data: ISparkpostSend, metadata: IMetadata) {
        super(data, metadata);
    }

    protected override get data(): ISparkpostSend {
        return super.data as ISparkpostSend;
    }

    public get email(): IMail|undefined {
        return this.data.email;
    }

    public get transmissionId(): string|undefined {
        return this.data.transmissionId;
    }

    public set transmissionId(value: string|undefined) {
        this.data.transmissionId = value;
    }

}
