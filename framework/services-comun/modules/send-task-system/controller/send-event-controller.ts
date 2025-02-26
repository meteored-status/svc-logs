import {SendEvent} from "../data/model/send-event";
import {DAOFactory} from "../data/dao/d-a-o-factory";
import {Send} from "../data/model/send";

export abstract class SendEventController {
    /* STATIC */

    /* INSTANCE */
    protected constructor(protected readonly factory: DAOFactory) {
    }

    public async handle(event: SendEvent): Promise<void> {
        // Recuperamos el Send asociado al evento
        const send = await this.getSendByEvent(event);

        event.sendId = send.id;

        await this.factory.event.save(event);
    }

    protected abstract getSendByEvent(event: SendEvent): Promise<Send>;

}
