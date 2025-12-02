import {AbstractSendScheduleDAO} from "../send-schedule-d-a-o";
import {MySQL} from "../../../../../database/mysql";
import {SendSchedule} from "../../../model/send-schedule";
import {MySQLBulkConfig, MySQL as MySQLBulk} from "../../../../../database/bulk/my-s-q-l";

export class MySQLSendScheduleDAO extends AbstractSendScheduleDAO {
    /* STATIC */
    private static readonly COMMON_FIELDS: string = `st.id, st.send_task, st.send_date`;

    /* INSTANCE */
    public constructor(private readonly db: MySQL) {
        super();
    }

    public override async createBulk(config?: MySQLBulkConfig<SendSchedule>): Promise<MySQLBulk<SendSchedule>> {
        return new MySQLBulk<SendSchedule>(this.db, {
            table: "send_schedule",
            query: "INSERT INTO send_schedule (id, send_task, send_date) values (?, ?, ?)",
            getParams: (schedule: SendSchedule) => {
                return [
                    schedule.id,
                    schedule.sendTask,
                    schedule.sendDate,
                ];
            },
            duplicate: [
                "send_date",
                "send_task",
            ],
            ...config,
        });
    }

    public override async findBySendTask(sendTaskId: number): Promise<SendSchedule> {
        return this.db.selectOne(`SELECT ${MySQLSendScheduleDAO.COMMON_FIELDS} FROM send_schedule st WHERE st.send_task = ?`, [
            sendTaskId
        ], {
            fn: row => new SendSchedule({
                id: row.id,
                sendTask: row.send_task,
                sendDate: row.send_date,
            })
        });
    }

    public override async selectBySendTask(sendTaskId: number|number[]): Promise<SendSchedule[]> {
        let sendTaskIds: number[];
        if (Array.isArray(sendTaskId)) {
            sendTaskIds = sendTaskId;
        } else {
            sendTaskIds = [sendTaskId];
        }

        if (sendTaskIds.length === 0) {
            return [];
        }

        const query = `SELECT ${MySQLSendScheduleDAO.COMMON_FIELDS} FROM send_schedule st WHERE ${sendTaskIds.map(stId => 'st.send_task = ?').join(' OR ')}`;

        return this.db.select<any, SendSchedule>(query, sendTaskIds, {
            fn: row => new SendSchedule({
                id: row.id,
                sendTask: row.send_task,
                sendDate: row.send_date,
            })
        });
    }
}
