/**
 * Editor: Bixus
 * Fecha: Wed, 23 Sep 2026 08:46:26 GMT
 * Hash: 4c1df7ea1d5b0f2333fcca9ffe6e47ee
 * Versión: 2026.9.23+3-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

import type {Send} from "../../model/send";

export interface ISendDAO {
    save(send: Send): Promise<Send>;

    getPending(): Promise<Send[]>;

    findByTransmissionId(transmissionId: string): Promise<Send>;
}

export abstract class SendDAO implements ISendDAO {
    /* INSTANCE */
    public abstract save(send: Send): Promise<Send>;

    public abstract getPending(): Promise<Send[]>;

    public abstract findByTransmissionId(transmissionId: string): Promise<Send>;
}
