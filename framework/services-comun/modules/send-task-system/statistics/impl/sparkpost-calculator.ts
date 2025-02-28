import {Calculator} from "../calculator";
import {SparkpostEvent} from "../../data/model/sparkpost-event";
import {Receiver} from "../../data/model/receiver";

export class SparkpostCalculator extends Calculator {
    /* STATIC */

    /* INSTANCE */
    public constructor(event: SparkpostEvent) {
        super(event);
    }

    protected override get event(): SparkpostEvent {
        return this._event as SparkpostEvent;
    }

    public calculate(receiver: Receiver): void {
        const e = this.event.messageData;

        const eventTime = parseInt(e.timestamp) * 1000;

        switch (e.type) {
            case "delivery":
                receiver.statistics!.received = true;
                receiver.statistics!.received_time = eventTime;
                break;
            case "bounce":
                receiver.statistics!.bounce = true;
                receiver.statistics!.bounce_count++;
                break;
            case "spam_complaint":
                receiver.statistics!.spam = true;
                receiver.statistics!.spam_count++;
                break;
            case "initial_open":
            case "amp_initial_open":
                receiver.statistics!.times_opened++;
                receiver.statistics!.first_open_count++;

                if (!receiver.statistics!.first_open_time || receiver.statistics!.first_open_time > eventTime) {
                    receiver.statistics!.first_open_time = eventTime;
                    if (receiver.statistics!.received_time) {
                        receiver.statistics!.time_until_open = eventTime - receiver.statistics!.received_time;
                    }
                }
                break;
            case "open":
            case "amp_open":
                receiver.statistics!.times_opened++;

                if (!receiver.statistics!.first_open_time || receiver.statistics!.first_open_time > eventTime) {
                    receiver.statistics!.first_open_time = eventTime;
                    if (receiver.statistics!.received_time) {
                        receiver.statistics!.time_until_open = eventTime - receiver.statistics!.received_time;
                    }
                }
                break;
            case "click":
            case "amp_click":
                receiver.statistics!.times_clicked++;
                break;
            case "list_unsubscribe":
            case "link_unsubscribe":
                receiver.statistics!.unsubscribe = true;
                receiver.statistics!.unsubscribe_count++;
                break;

        }
    }
}
