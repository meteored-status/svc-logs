import {Message as PubSubMessage} from "@google-cloud/pubsub";

export class Message<T> {
    /* STATIC */

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
