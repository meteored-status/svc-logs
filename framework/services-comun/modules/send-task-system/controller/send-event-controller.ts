/**
 * Editor: Bixus
 * Fecha: Wed, 23 Sep 2026 08:46:26 GMT
 * Hash: 642e9c0daa645bf3aeb5795c3fc6ad38
 * Versión: 2026.9.23+3-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

import type {SendEvent} from "../data/model/send-event";
import type {IDAOFactory} from "../data/dao/d-a-o-factory";
import type {Send} from "../data/model/send";

export abstract class SendEventController {
    /* INSTANCE */
    protected constructor(protected readonly factory: IDAOFactory) {
    }

    public async handle(event: SendEvent): Promise<void> {
        // Recuperamos el Send asociado al evento
        const send = await this.getSendByEvent(event);

        event.sendId = send.id;

        await this.factory.event.save(event);
    }

    protected abstract getSendByEvent(event: SendEvent): Promise<Send>;

}
