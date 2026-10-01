/**
 * Editor: Bixus
 * Fecha: Wed, 23 Sep 2026 08:46:25 GMT
 * Hash: de7f5eda19c184e6f8d9d5a750cdb612
 * Versión: 2026.9.23+3-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

import {TransactionManager} from "../transaction/transaction-manager";
import {GoogleCloudTransaction} from "./google-cloud-transaction";

export class GoogleCloudTransactionManager extends TransactionManager {
    /* INSTANCE */
    public constructor() {
        super();
    }

    public override get(): Promise<GoogleCloudTransaction> {
        return Promise.resolve(new GoogleCloudTransaction());
    }
}