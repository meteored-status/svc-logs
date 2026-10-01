/**
 * Editor: Bixus
 * Fecha: Wed, 23 Sep 2026 08:46:26 GMT
 * Hash: 6e0f3aaa2a3659684afbfc80f67b694f
 * Versión: 2026.9.23+3-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

import type {Message as PubSubMessage} from "@google-cloud/pubsub";

export class Message<T> {
    /* INSTANCE */
    public constructor(private readonly msg: PubSubMessage) {
    }

    public get data(): T {
        return JSON.parse(this.msg.data.toString());
    }

    public accept(): void {
        this.msg.ack();
    }

    public dismiss(): void {
        this.msg.ack();
    }
}
