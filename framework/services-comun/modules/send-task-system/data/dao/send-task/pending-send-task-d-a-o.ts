import {PendingSendTask} from "../../model/pending-send-task";

export type Callback = (pendingSendTask: PendingSendTask) => void;

export interface PendingSendTaskDAO {
    save(pendingSendTask: PendingSendTask): Promise<PendingSendTask>;
    listen(callback: Callback): Promise<void>;
}

export abstract class AbstractPendingSendTaskDAO implements PendingSendTaskDAO {
    /* STATIC */

    /* INSTANCE */
    public abstract save(pendingSendTask: PendingSendTask): Promise<PendingSendTask>;
    public abstract listen(callback: Callback): Promise<void>;
}
