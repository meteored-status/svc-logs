/**
 * Editor: Bixus
 * Fecha: Wed, 23 Sep 2026 08:46:26 GMT
 * Hash: 6071fae792904f2eeebd044de4eda0e3
 * Versión: 2026.9.23+3-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

import {SendEventController} from "./send-event-controller";
import type {IDAOFactory} from "../data/dao/d-a-o-factory";
import type {SparkpostEvent} from "../data/model/sparkpost-event";
import type {SparkpostSend} from "../data/model/sparkpost-send";

export class SparkpostEventController extends SendEventController {
    /* INSTANCE */
    public constructor(factory: IDAOFactory) {
        super(factory);
    }

    protected async getSendByEvent(event: SparkpostEvent): Promise<SparkpostSend> {
        return await this.factory.send.findByTransmissionId(event.messageData.transmission_id) as SparkpostSend;
    }

}
