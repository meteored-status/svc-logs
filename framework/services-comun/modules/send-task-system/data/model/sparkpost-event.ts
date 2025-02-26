import {ISendEvent, SendEvent, TEvent} from "./send-event";
import {IMessageIDEvent, ITrackEvent, IUnsubscribeEvent} from "../../../email/webhook/sparkpost/sparkpost";

interface ISparkpostEvent extends ISendEvent {
    messageData: IMessageIDEvent|ITrackEvent|IUnsubscribeEvent;
}

export class SparkpostEvent extends SendEvent {
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

    /* INSTANCE */
    public constructor(data: ISparkpostEvent) {
        super(data);
    }

    protected override get data(): ISparkpostEvent {
        return super.data as ISparkpostEvent;
    }

    public get messageData(): IMessageIDEvent|ITrackEvent|IUnsubscribeEvent {
        return this.data.messageData;
    }



}
