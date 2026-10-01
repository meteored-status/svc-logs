/**
 * Editor: Bixus
 * Fecha: Wed, 23 Sep 2026 08:46:26 GMT
 * Hash: 95f1eb7ce9ee2ba20786f541f8ebbc87
 * Versión: 2026.9.23+3-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

import type {Send} from "../data/model/send";
import {TSend} from "../data/model/send";
import {SparkpostReceiverIdentifier} from "./impl/sparkpost-receiver-identifier";
import type {SparkpostSend} from "../data/model/sparkpost-send";

export class ReceiverIdentifierBuilder {
    /* STATIC */

    private static instance: ReceiverIdentifierBuilder | null = null;

    /* INSTANCE */
    private constructor() {
    }

    public static getInstance(): ReceiverIdentifierBuilder {
        if (ReceiverIdentifierBuilder.instance === null) {
            ReceiverIdentifierBuilder.instance = new ReceiverIdentifierBuilder();
        }
        return ReceiverIdentifierBuilder.instance;
    }

    public build(send: Send): SparkpostReceiverIdentifier {
        switch (send.type) {
            case TSend.SPARKPOST:
                return new SparkpostReceiverIdentifier(send as SparkpostSend);
        }
    }
}
