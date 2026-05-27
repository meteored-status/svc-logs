/**
 * Editor: David Martínez Moya
 * Fecha: Wed, 27 May 2026 06:28:30 GMT
 * Hash: 7a0f28eff52eb3327934631b9c4007e3
 * Versión: 2026.5.27+1-davidmartinezmoya
 */

import {AbstractSendTaskDAO} from "../send-task-d-a-o";
import {MySQL} from "../../../../../database/mysql";
import {SendTask, TSendTaskStatus, TSendTaskType} from "../../../model/send-task";
import {Pagination} from "../../../../../database/pagination";

type SendTaskRow = {
    id: number;
    status: number;
    start_validity: Date;
    end_validity: Date | null;
    type: TSendTaskType;
}

export class MySQLSendTaskDAO extends AbstractSendTaskDAO {
    /* STATIC */
    private static COMMON_FIELDS: string = 'st.id, st.status, st.start_validity, st.end_validity, st.type';

    /* INSTANCE */
    public constructor(private readonly db: MySQL) {
        super();
    }

    public async scheduled(limitDate: Date, type: TSendTaskType, pageSize: number = 5000): Promise<Pagination<SendTask>> {
        return new Pagination(pageSize, {
            loadPage: async (_: number, pageSize: number) => {
                const sql = `
                    select ${MySQLSendTaskDAO.COMMON_FIELDS}
                    from send_task st
                        inner join send_schedule ss on ss.send_task = st.id
                    where st.status = ?
                        and st.type = ?
                        and ss.send_date <= ?
                    order by st.id asc
                    limit ? offset ?
                `.replaceAll(`\n`, ' ').replaceAll(/\s+/g, ' ').trim();

                return this.db.select<SendTaskRow, SendTask>(sql, [
                    TSendTaskStatus.ACTIVE,
                    type,
                    limitDate,
                    pageSize,
                    0,
                ], {
                    fn: row => this.rowToSendTask(row),
                    master: true, // Forzamos lectura en master para evitar problemas de replicación
                });
            }
        });
    }

    public async countScheduled(limitDate: Date, type: TSendTaskType): Promise<number> {
        const sql = `
            select count(distinct st.id) as total
            from send_task st
                inner join send_schedule ss on ss.send_task = st.id
            where st.status = ?
                and st.type = ?
                and ss.send_date <= ?
        `.replaceAll(`\n`, ' ').replaceAll(/\s+/g, ' ').trim();

        const row = await this.db.selectOne<{ total: number }>(sql, [
            TSendTaskStatus.ACTIVE,
            type,
            limitDate,
        ], {
            master: true, // Forzamos lectura en master para evitar problemas de replicación
        });

        return row.total;
    }

    private rowToSendTask(row: SendTaskRow): SendTask {
        return new SendTask({
            id: row.id,
            status: row.status,
            start_validity: row.start_validity,
            end_validity: row.end_validity ? row.end_validity : undefined,
            type: row.type
        });
    }
}
