import {AbstractPeriodicityDAO} from "../periodicity-d-a-o";
import {MySQL} from "../../../../../database/mysql";
import {IPeriodicity, Periodicity} from "../../../model/periodicity";

export class MySQLPeriodicityDAO extends AbstractPeriodicityDAO {
    /* STATIC */
    private static COMMON_FIELDS: string = 'p.id, p.pattern, p.send_task_id, p.timezone';

    /* INSTANCE */
    public constructor(private readonly db: MySQL) {
        super();
    }

    public override async selectBySendTask(sendTaskId: number|number[]): Promise<Periodicity[]> {
        let sendTaskIds: number[];
        if (Array.isArray(sendTaskId)) {
            sendTaskIds = sendTaskId;
        } else {
            sendTaskIds = [sendTaskId];
        }

        if (sendTaskIds.length === 0) {
            return [];
        }

        const query = `select ${MySQLPeriodicityDAO.COMMON_FIELDS} from periodicity p where ${sendTaskIds.map(stId => 'p.send_task_id = ?').join(' or ')}`;

        return this.db.select<IPeriodicity, Periodicity>(query, sendTaskIds, {
            fn: row => new Periodicity(row)
        });
    }
}
