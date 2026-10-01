/**
 * Editor: Bixus
 * Fecha: Wed, 23 Sep 2026 08:46:26 GMT
 * Hash: 6db1d964052d068213a255470f3eaa21
 * Versión: 2026.9.23+3-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

import type {ISendEvent} from "./send-event";
import {SendEvent, TEvent} from "./send-event";
import type {IMessageIDEvent, ITrackEvent, IUnsubscribeEvent} from "../../../email/webhook/sparkpost/sparkpost";

interface ISparkpostEvent extends ISendEvent {
    messageData: IMessageIDEvent | ITrackEvent | IUnsubscribeEvent;
}

export class SparkpostEvent extends SendEvent {
    /* INSTANCE */
    public constructor(data: ISparkpostEvent) {
        super(data);
    }

    public get messageData(): IMessageIDEvent | ITrackEvent | IUnsubscribeEvent {
        return this.data.messageData;
    }

    protected override get data(): ISparkpostEvent {
        return super.data as ISparkpostEvent;
    }

    /* STATIC */
    public static create(date: Date, data: IMessageIDEvent): SparkpostEvent {
        return new SparkpostEvent({
            type: TEvent.SPAKPOST,
            created: new Date(),
            received: date,
            messageData: data,
            receiver: data.rcpt_to,
        });
    }

}
