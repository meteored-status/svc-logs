import {SendEvent} from "../data/model/send-event";
import {Receiver} from "../data/model/receiver";

export abstract class Calculator {
    /* STATIC */

    /* INSTANCE */
    protected constructor(protected readonly _event: SendEvent) {
    }

    protected get event(): SendEvent {
        return this._event;
    }

    public abstract calculate(receiver: Receiver): void;
}
