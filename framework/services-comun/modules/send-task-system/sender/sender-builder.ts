/**
 * Editor: Bixus
 * Fecha: Wed, 23 Sep 2026 08:46:26 GMT
 * Hash: 4a127ef5c48440921fc0f00663831fff
 * Versión: 2026.9.23+3-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

import type {Sender} from "./sender";
import type {Send} from "../data/model/send";
import {TSend} from "../data/model/send";
import {SparkpostSender} from "./impl/sparkpost-sender";
import type {SparkpostSend} from "../data/model/sparkpost-send";

export class SenderBuilder {
    /* STATIC */

    private static instance: SenderBuilder | null = null;

    /* INSTANCE */
    private constructor() {
    }

    public static getInstance(): SenderBuilder {
        if (SenderBuilder.instance === null) {
            SenderBuilder.instance = new SenderBuilder();
        }
        return SenderBuilder.instance;
    }

    public build(send: Send): Sender {
        switch (send.type) {
            case TSend.SPARKPOST:
                return new SparkpostSender(send as SparkpostSend);
        }
    }
}
