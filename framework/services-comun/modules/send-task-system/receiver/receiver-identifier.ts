/**
 * Editor: Bixus
 * Fecha: Wed, 23 Sep 2026 08:46:26 GMT
 * Hash: 11d65bc4c219150608a15beb419e111b
 * Versión: 2026.9.23+3-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

import type {Send} from "../data/model/send";

export abstract class ReceiverIdentifier {
    /* INSTANCE */
    public constructor(private readonly _send: Send) {
    }

    protected get send(): Send {
        return this._send;
    }

    public abstract identify(): string[];
}
