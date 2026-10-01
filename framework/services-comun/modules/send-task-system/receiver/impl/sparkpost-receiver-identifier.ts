/**
 * Editor: Bixus
 * Fecha: Wed, 23 Sep 2026 08:46:26 GMT
 * Hash: 228ae9c6f170c5b5300c0f35df6ae72d
 * Versión: 2026.9.23+3-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

import {ReceiverIdentifier} from "../receiver-identifier";
import type {SparkpostSend} from "../../data/model/sparkpost-send";

export class SparkpostReceiverIdentifier extends ReceiverIdentifier {
    /* INSTANCE */
    public constructor(send: SparkpostSend) {
        super(send);
    }

    protected override get send(): SparkpostSend {
        return super.send as SparkpostSend;
    }

    public override identify(): string[] {
        if (!this.send.email) {
            throw new Error('Invalid send email');
        }
        return this.send.email.to.map(to => to.email);
    }
}
