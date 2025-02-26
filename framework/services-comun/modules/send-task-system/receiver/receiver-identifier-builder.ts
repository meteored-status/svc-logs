import {Send, TSend} from "../data/model/send";
import {SparkpostReceiverIdentifier} from "./impl/sparkpost-receiver-identifier";
import {SparkpostSend} from "../data/model/sparkpost-send";

export class ReceiverIdentifierBuilder {
    /* STATIC */

    private static instance: ReceiverIdentifierBuilder|null = null;

    public static getInstance(): ReceiverIdentifierBuilder {
        if (ReceiverIdentifierBuilder.instance === null) {
            ReceiverIdentifierBuilder.instance = new ReceiverIdentifierBuilder();
        }
        return ReceiverIdentifierBuilder.instance;
    }

    /* INSTANCE */
    private constructor() {
    }

    public build(send: Send): SparkpostReceiverIdentifier {
        switch (send.type) {
            case TSend.SPARKPOST:
                return new SparkpostReceiverIdentifier(send as SparkpostSend);
        }
    }
}
