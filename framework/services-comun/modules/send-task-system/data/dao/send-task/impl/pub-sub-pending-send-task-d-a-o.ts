/**
 * Editor: Bixus
 * Fecha: Wed, 23 Sep 2026 08:46:26 GMT
 * Hash: b3eae00f98332a357e8519b5b792c1f9
 * Versión: 2026.9.23+3-bixus
 * Anterior: 2026.5.27+1-davidmartinezmoya
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

import type {Callback} from "../pending-send-task-d-a-o";
import {AbstractPendingSendTaskDAO} from "../pending-send-task-d-a-o";
import type {ConfigDataQueue, PubSub} from "../../../../../messages/pubsub/v2";
import {PendingSendTask} from "../../../model/pending-send-task";

export class PubSubPendingSendTaskDAO extends AbstractPendingSendTaskDAO {
    /* INSTANCE */
    public constructor(private readonly client: PubSub, private readonly configDataQueue: ConfigDataQueue) {
        super();
    }

    public override async save(pendingSendTask: PendingSendTask): Promise<PendingSendTask> {
        await this.client.sendMessage({
            json: pendingSendTask.raw(),
            attributes: {
                'send-task-type': pendingSendTask.type.toString(),
            }
        }, this.configDataQueue.topicName, {
            messageOrdering: false,
            batching: {
                maxMessages: 1000,
                maxBytes: 9 * 1024 * 1024,
            },
            gaxOpts: {
                retry: {
                    retryCodes: [
                        1,
                        2,
                        4,
                        8,
                        10,
                        13,
                        14,
                    ],
                }
            }
        });

        return pendingSendTask;
    }

    public override async listen(callback: Callback): Promise<void> {
        this.client.listen(message => {
            const task = message.data;
            const accept = () => {
                message.accept();
            };
            if (task['id'] && task['type']) {
                callback(new PendingSendTask({
                    id: parseInt(task['id'], 10),
                    type: parseInt(task['type']),
                    schedule_at: parseInt(task['schedule_at'], 10),
                }, accept));
            } else {
                throw new Error('Unknown task type');
            }
        }, this.configDataQueue.subscriptionName, {
            batching: {
                maxMessages: this.configDataQueue.messageLimit,
                maxMilliseconds: this.configDataQueue.waitTimeMs
            }
        });
    }

}
