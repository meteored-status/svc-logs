/**
 * Editor: Bixus
 * Fecha: Wed, 23 Sep 2026 08:46:26 GMT
 * Hash: c7311395c649c219fdf72b7c7fa5fa3b
 * Versión: 2026.9.23+3-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

import type {PendingSendTask} from "../../model/pending-send-task";

export type Callback = (pendingSendTask: PendingSendTask) => void;

export interface PendingSendTaskDAO {
    save(pendingSendTask: PendingSendTask): Promise<PendingSendTask>;
    listen(callback: Callback): Promise<void>;
}

export abstract class AbstractPendingSendTaskDAO implements PendingSendTaskDAO {
    /* INSTANCE */
    public abstract save(pendingSendTask: PendingSendTask): Promise<PendingSendTask>;
    public abstract listen(callback: Callback): Promise<void>;
}
