/**
 * Editor: Bixus
 * Fecha: Wed, 23 Sep 2026 08:46:26 GMT
 * Hash: 53e9339b88f86463c0b9b7588a8ed91b
 * Versión: 2026.9.23+3-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

import type {Bulk, BulkConfig} from "../../../../database/bulk";
import type {SendSchedule} from "../../model/send-schedule";

export interface SendScheduleDAO {
    createBulk(config?: BulkConfig): Promise<Bulk<SendSchedule>>;
    findBySendTask(sendTaskId: number): Promise<SendSchedule>;
    selectBySendTask(sendTaskId: number|number[]): Promise<SendSchedule[]>;
    deleteById(ids: number|number[]): Promise<void>;
}

export abstract class AbstractSendScheduleDAO implements SendScheduleDAO {
    /* INSTANCE */
    public abstract createBulk(config?: BulkConfig): Promise<Bulk<SendSchedule>>;
    public abstract findBySendTask(sendTaskId: number): Promise<SendSchedule>;
    public abstract selectBySendTask(sendTaskId: number|number[]): Promise<SendSchedule[]>;
    public abstract deleteById(ids: number|number[]): Promise<void>;
}
