import {Sender} from "./sender";
import {Send, TSend} from "../data/model/send";
import {SparkpostSender} from "./impl/sparkpost-sender";
import {SparkpostSend} from "../data/model/sparkpost-send";

export class SenderBuilder {
    /* STATIC */

    private static instance: SenderBuilder|null = null;

    public static getInstance(): SenderBuilder {
        if (SenderBuilder.instance === null) {
            SenderBuilder.instance = new SenderBuilder();
        }
        return SenderBuilder.instance;
    }

    /* INSTANCE */
    private constructor() {
    }

    public build(send: Send): Sender {
        switch (send.type) {
            case TSend.SPARKPOST:
                return new SparkpostSender(send as SparkpostSend);
        }
    }
}
