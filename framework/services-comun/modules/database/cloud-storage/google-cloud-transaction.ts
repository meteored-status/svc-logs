/**
 * Editor: Bixus
 * Fecha: Wed, 23 Sep 2026 08:46:25 GMT
 * Hash: 597cd88ea388bbadeb5934aefdcd30db
 * Versión: 2026.9.23+3-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

import {Transaction} from "../transaction/transaction";

export class GoogleCloudTransaction extends Transaction {
    /* INSTANCE */
    public constructor() {
        super();
    }

    public override async begin(): Promise<void> {
        return Promise.resolve();
    }

    public override async commit(): Promise<void> {
        return Promise.resolve();
    }

    public override async rollback(): Promise<void> {
        return Promise.resolve();
    }
}