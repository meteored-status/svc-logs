/**
 * Editor: Bixus
 * Fecha: Wed, 23 Sep 2026 08:46:26 GMT
 * Hash: 7d015514a79137ad379f7859489e0102
 * Versión: 2026.9.23+3-bixus
 * Anterior: 2026.5.27+1-davidmartinezmoya
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

import type {SendTask, TSendTaskType} from "../../model/send-task";
import type {Pagination} from "../../../../database/pagination";

export interface SendTaskDAO {
    scheduled(limitDate: Date, type: TSendTaskType, pageSize?: number): Promise<Pagination<SendTask>>
    countScheduled(limitDate: Date, type: TSendTaskType): Promise<number>;
}

export abstract class AbstractSendTaskDAO implements SendTaskDAO {
    /* INSTANCE */
    public abstract scheduled(limitDate: Date, type: TSendTaskType, pageSize?: number): Promise<Pagination<SendTask>>;
    public abstract countScheduled(limitDate: Date, type: TSendTaskType): Promise<number>;
}
