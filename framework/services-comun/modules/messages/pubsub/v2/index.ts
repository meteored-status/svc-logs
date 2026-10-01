/**
 * Editor: Bixus
 * Fecha: Wed, 23 Sep 2026 08:46:26 GMT
 * Hash: f32e301eef4c7660ec078b6b24f1e306
 * Versión: 2026.9.23+3-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

import type {
    PublishOptions,
    SubscriptionOptions, Topic
} from "@google-cloud/pubsub";
import {PubSub as OriginalPubSub} from "@google-cloud/pubsub";
import type {MessageOptions} from "@google-cloud/pubsub/build/src/topic";

import {readJSON} from "../../../utiles/fs";
import {Message} from "./message";

export type PubSubBuild = {
    credenciales?: string;
    topic?: string;
    subscription?: string;
}

export type TMessageData = MessageOptions;

export type ConfigDataQueue = {
    topicName: string;
    subscriptionName: string;
    messageLimit?: number;
    waitTimeMs?: number;
}

export class PubSub {
    /* STATIC */
    public static build({credenciales = 'files/credenciales/pubsub.json', topic, subscription}: PubSubBuild = {}): PubSub {
        return new PubSub(credenciales, topic, subscription);
    }

    /* INSTANCE */
    private _client: Promise<OriginalPubSub>|null;
    private _topics: Record<string, Promise<Topic>>;
    private constructor(private readonly credenciales: string, private readonly topic?: string, private readonly subscription?: string) {
        this._client = null;
        this._topics = {};
    }

    private async initClient(): Promise<OriginalPubSub> {
        if (!this._client) {

            this._client = new Promise((resolve, reject) => {
                readJSON(this.credenciales).then(data => {
                    // TODO - No funciona la solución sugerida. Seguimos usando "credentials".
                    const client = new OriginalPubSub({
                        credentials: data,
                    })
                    resolve(client);
                }).catch(reject);
            });
        }
        return this._client;
    }

    public async sendMessage(data: TMessageData, topic?: string, publishOptions?: PublishOptions): Promise<void> {
        const targetTopic = topic || this.topic;

        if (!targetTopic) {
            throw new Error('Topic not defined');
        }

        const pubsubTopic = await (this._topics[targetTopic]??=this.initClient().then(client => {
            const newTopic = client.topic(targetTopic);
            if(publishOptions) {newTopic.setPublishOptions(publishOptions);}
            return newTopic;
        }));

        await pubsubTopic.publishMessage(data);
    }

    public async createTopic(topicName: string): Promise<void> {
        const client = await this.initClient();
        await client.createTopic(topicName);
    }

    public async createSubscription(subscriptionName: string, topicName?: string): Promise<void> {
        const targetTopic = topicName || this.topic;

        if (!targetTopic) {
            throw new Error('Topic not defined');
        }

        const client = await this.initClient();
        const pubsubTopic = client.topic(targetTopic);
        await pubsubTopic.createSubscription(subscriptionName);
    }

    public listen(callback: (msg: Message<any>) => void, subscription?: string, suscriptionOptions?: SubscriptionOptions): void {
        this.initClient().then(client => {
            const subscriptionName = subscription || this.subscription;
            if (subscriptionName) {
                const sub = client.subscription(subscriptionName, suscriptionOptions);
                sub.on('message', (message) => {
                    const msg = new Message<any>(message);
                    callback(msg);
                });
            }
        });
    }
}
