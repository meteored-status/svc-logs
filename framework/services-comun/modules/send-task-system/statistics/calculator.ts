/**
 * Editor: Bixus
 * Fecha: Wed, 23 Sep 2026 08:46:26 GMT
 * Hash: 1bc067d9b66b3ead69430972cd5d69a7
 * Versión: 2026.9.23+3-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

import type {SendEvent} from "../data/model/send-event";
import type {Receiver} from "../data/model/receiver";

export abstract class Calculator {
    /* INSTANCE */
    protected constructor(protected readonly _event: SendEvent) {
    }

    protected get event(): SendEvent {
        return this._event;
    }

    public abstract calculate(receiver: Receiver): void;
}
