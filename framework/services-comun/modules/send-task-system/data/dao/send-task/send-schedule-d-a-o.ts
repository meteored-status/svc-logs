import {Bulk, BulkConfig} from "../../../../database/bulk";
import {SendSchedule} from "../../model/send-schedule";

export interface SendScheduleDAO {
    createBulk(config?: BulkConfig): Promise<Bulk<SendSchedule>>;
    findBySendTask(sendTaskId: number): Promise<SendSchedule>;
    selectBySendTask(sendTaskId: number|number[]): Promise<SendSchedule[]>;
    deleteById(ids: number|number[]): Promise<void>;
}

export abstract class AbstractSendScheduleDAO implements SendScheduleDAO {
    /* STATIC */

    /* INSTANCE */
    public abstract createBulk(config?: BulkConfig): Promise<Bulk<SendSchedule>>;
    public abstract findBySendTask(sendTaskId: number): Promise<SendSchedule>;
    public abstract selectBySendTask(sendTaskId: number|number[]): Promise<SendSchedule[]>;
    public abstract deleteById(ids: number|number[]): Promise<void>;
}
