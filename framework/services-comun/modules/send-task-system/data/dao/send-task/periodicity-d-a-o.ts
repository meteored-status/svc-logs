import {Periodicity} from "../../model/periodicity";

export interface PeriodicityDAO {
    selectBySendTask(sendTaskId: number|number[]): Promise<Periodicity[]>;
}

export abstract class AbstractPeriodicityDAO implements PeriodicityDAO {
    /* STATIC */

    /* INSTANCE */
    public abstract selectBySendTask(sendTaskId: number|number[]): Promise<Periodicity[]>;
}
