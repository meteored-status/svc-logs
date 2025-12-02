import {SendEventController} from "./send-event-controller";
import {IDAOFactory} from "../data/dao/d-a-o-factory";
import {SparkpostEvent} from "../data/model/sparkpost-event";
import {SparkpostSend} from "../data/model/sparkpost-send";

export class SparkpostEventController extends SendEventController {
    /* STATIC */

    /* INSTANCE */
    public constructor(factory: IDAOFactory) {
        super(factory);
    }

    protected async getSendByEvent(event: SparkpostEvent): Promise<SparkpostSend> {
        return await this.factory.send.findByTransmissionId(event.messageData.transmission_id) as SparkpostSend;
    }

}
