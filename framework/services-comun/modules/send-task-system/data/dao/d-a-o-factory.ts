import {SendDAO} from "./send/send-d-a-o";
import {ElasticSendDAO} from "./send/impl/elastic-send-d-a-o";
import elastic from "../../../utiles/elastic";
import {Configuracion} from "../../utiles/config";
import {EventDAO} from "./event/event-d-a-o";
import {ElasticEventDAO} from "./event/impl/elastic-event-d-a-o";
import {ReceiverDAO} from "./receiver/receiver-d-a-o";
import {ElasticReceiverDAO} from "./receiver/impl/elastic-receiver-d-a-o";
import {MySQL} from "../../../database/mysql";
import {SendTaskDAO} from "./send-task/send-task-d-a-o";
import {MySQLSendTaskDAO} from "./send-task/impl/my-s-q-l-send-task-d-a-o";
import {PendingSendTaskDAO} from "./send-task/pending-send-task-d-a-o";
import {PubSubPendingSendTaskDAO} from "./send-task/impl/pub-sub-pending-send-task-d-a-o";
import {ConfigDataQueue, PubSub} from "../../../messages/pubsub/v2";
import {SendScheduleDAO} from "./send-task/send-schedule-d-a-o";
import {PeriodicityDAO} from "./send-task/periodicity-d-a-o";

export type PubSubConfig = {
    client: PubSub;
    config: ConfigDataQueue;
}

export interface IDAOFactory {
    send: SendDAO;
    event: EventDAO;
    receiver: ReceiverDAO;
    sendTask: SendTaskDAO;
    pendingSendTask: PendingSendTaskDAO;
    sendSchedule: SendScheduleDAO;
    periodicity: PeriodicityDAO;
}

// export abstract class DAOFactory {
//     /* INSTANCE */
//     private readonly _sendDAO: SendDAO;
//     private readonly _eventDAO: EventDAO;
//     private readonly _receiverDAO: ReceiverDAO;
//     private readonly _sendTaskDAO: SendTaskDAO;
//     private readonly _pendingSendTaskDAO: PendingSendTaskDAO;
//
//     private constructor(config: Configuracion, mysql: MySQL, pubsubConfig: PubSubConfig) {
//         this._sendDAO = new ElasticSendDAO(config.elasticSearch, elastic);
//         this._eventDAO = new ElasticEventDAO(config.elasticSearch, elastic);
//         this._receiverDAO = new ElasticReceiverDAO(config.elasticSearch, elastic);
//         this._sendTaskDAO = new MySQLSendTaskDAO(mysql);
//         this._pendingSendTaskDAO = new PubSubPendingSendTaskDAO(pubsubConfig.client, pubsubConfig.config);
//     }
//
//     public get send(): SendDAO {
//         return this._sendDAO;
//     }
//
//     public get event(): EventDAO {
//         return this._eventDAO;
//     }
//
//     public get receiver(): ReceiverDAO {
//         return this._receiverDAO;
//     }
//
//     public get sendTask(): SendTaskDAO {
//         return this._sendTaskDAO;
//     }
//
//     public get pendingSendTask(): PendingSendTaskDAO {
//         return this._pendingSendTaskDAO;
//     }
//
//     /* STATIC */
//     public static create(config: Configuracion, mysql: MySQL, pubsubConfig: PubSubConfig): DAOFactory {
//         return new DAOFactory(config, mysql, pubsubConfig);
//     }
// }
