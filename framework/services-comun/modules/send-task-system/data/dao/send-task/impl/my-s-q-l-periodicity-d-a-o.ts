/**
 * Editor: Bixus
 * Fecha: Wed, 23 Sep 2026 08:46:26 GMT
 * Hash: aa60023c7817eca68502e97c46567292
 * Versión: 2026.9.23+3-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

import {AbstractPeriodicityDAO} from "../periodicity-d-a-o";
import type {MySQL} from "../../../../../database/mysql";
import type {IPeriodicity} from "../../../model/periodicity";
import {Periodicity} from "../../../model/periodicity";

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
