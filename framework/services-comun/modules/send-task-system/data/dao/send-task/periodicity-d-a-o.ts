/**
 * Editor: Bixus
 * Fecha: Wed, 23 Sep 2026 08:46:26 GMT
 * Hash: 089f04b984b824adddb35327579634de
 * Versión: 2026.9.23+3-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

import type {Periodicity} from "../../model/periodicity";

export interface PeriodicityDAO {
    selectBySendTask(sendTaskId: number|number[]): Promise<Periodicity[]>;
}

export abstract class AbstractPeriodicityDAO implements PeriodicityDAO {
    /* INSTANCE */
    public abstract selectBySendTask(sendTaskId: number|number[]): Promise<Periodicity[]>;
}
