import {SendDAO} from "./send/send-d-a-o";
import {ElasticSendDAO} from "./send/impl/elastic-send-d-a-o";
import elastic from "../../../utiles/elastic";
import {Configuracion} from "../../utiles/config";
import {EventDAO} from "./event/event-d-a-o";
import {ElasticEventDAO} from "./event/impl/elastic-event-d-a-o";
import {ReceiverDAO} from "./receiver/receiver-d-a-o";
import {ElasticReceiverDAO} from "./receiver/impl/elastic-receiver-d-a-o";

export class DAOFactory {
    /* STATIC */
    public static create(config: Configuracion): DAOFactory {
        return new DAOFactory(config);
    }

    /* INSTANCE */
    private readonly _sendDAO: SendDAO;
    private readonly _eventDAO: EventDAO;
    private readonly _receiverDAO: ReceiverDAO;
    private constructor(config: Configuracion) {
        this._sendDAO = new ElasticSendDAO(config.elasticSearch, elastic);
        this._eventDAO = new ElasticEventDAO(config.elasticSearch, elastic);
        this._receiverDAO = new ElasticReceiverDAO(config.elasticSearch, elastic);
    }

    public get send(): SendDAO {
        return this._sendDAO;
    }

    public get event(): EventDAO {
        return this._eventDAO;
    }

    public get receiver(): ReceiverDAO {
        return this._receiverDAO;
    }
}
