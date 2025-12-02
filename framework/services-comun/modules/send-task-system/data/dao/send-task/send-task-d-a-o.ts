import {SendTask, TSendTaskType} from "../../model/send-task";
import {Pagination} from "../../../../database/pagination";

export interface SendTaskDAO {
    scheduled(limitDate: Date, type: TSendTaskType, pageSize?: number): Promise<Pagination<SendTask>>
}

export abstract class AbstractSendTaskDAO implements SendTaskDAO {
    /* STATIC */

    /* INSTANCE */
    public abstract scheduled(limitDate: Date, type: TSendTaskType, pageSize?: number): Promise<Pagination<SendTask>>;
}
