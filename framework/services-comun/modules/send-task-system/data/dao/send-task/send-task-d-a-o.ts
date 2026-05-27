/**
 * Editor: David Martínez Moya
 * Fecha: Wed, 27 May 2026 06:28:30 GMT
 * Hash: 607c1e043bd1d4454acc4cbfd88cd0b9
 * Versión: 2026.5.27+1-davidmartinezmoya
 */

import {SendTask, TSendTaskType} from "../../model/send-task";
import {Pagination} from "../../../../database/pagination";

export interface SendTaskDAO {
    scheduled(limitDate: Date, type: TSendTaskType, pageSize?: number): Promise<Pagination<SendTask>>
    countScheduled(limitDate: Date, type: TSendTaskType): Promise<number>;
}

export abstract class AbstractSendTaskDAO implements SendTaskDAO {
    /* STATIC */

    /* INSTANCE */
    public abstract scheduled(limitDate: Date, type: TSendTaskType, pageSize?: number): Promise<Pagination<SendTask>>;
    public abstract countScheduled(limitDate: Date, type: TSendTaskType): Promise<number>;
}
