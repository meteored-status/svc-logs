/**
 * Editor: Bixus
 * Fecha: Wed, 23 Sep 2026 08:46:26 GMT
 * Hash: 78382ad1ee6e980b8bd8c6f0978ffd73
 * Versión: 2026.9.23+3-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

import {TransactionManager} from "../transaction-manager";
import {FakeTransaction} from "./fake-transaction";

export class FakeTransactionManager extends TransactionManager {
    /* INSTANCE */
    public constructor() {
        super();
    }

    public override get(): Promise<FakeTransaction> {
        return Promise.resolve(new FakeTransaction());
    }
}