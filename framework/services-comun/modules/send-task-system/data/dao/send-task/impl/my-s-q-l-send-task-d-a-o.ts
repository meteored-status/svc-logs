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
