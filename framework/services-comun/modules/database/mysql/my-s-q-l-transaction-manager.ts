/**
 * Editor: Bixus
 * Fecha: Wed, 23 Sep 2026 08:46:26 GMT
 * Hash: 29968701e467abbf42cbde898e04afa9
 * Versión: 2026.9.23+3-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

import type {MySQL} from "./index";
import {TransactionManager} from "../transaction/transaction-manager";
import type {Transaction} from "./transaction";

export class MySQLTransactionManager extends TransactionManager {
    /* INSTANCE */
    public constructor(private readonly _db: MySQL) {
        super();
    }

    private get db(): MySQL {
        return this._db;
    }

    public override get(): Promise<Transaction> {
        return this.db.transaction();
    }
}
