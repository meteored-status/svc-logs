import {AbstractPendingSendTaskDAO, Callback} from "../pending-send-task-d-a-o";
import {ConfigDataQueue, PubSub} from "../../../../../messages/pubsub/v2";
import {PendingSendTask} from "../../../model/pending-send-task";

export class PubSubPendingSendTaskDAO extends AbstractPendingSendTaskDAO {
    /* STATIC */

    /* INSTANCE */
    public constructor(private readonly client: PubSub, private readonly configDataQueue: ConfigDataQueue) {
        super();
    }

    public override async save(pendingSendTask: PendingSendTask): Promise<PendingSendTask> {
        await this.client.sendMessage({
            json: pendingSendTask.raw()
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
