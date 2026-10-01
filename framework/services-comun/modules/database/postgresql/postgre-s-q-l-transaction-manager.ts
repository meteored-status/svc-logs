/**
 * Editor: Bixus
 * Fecha: Wed, 23 Sep 2026 08:46:26 GMT
 * Hash: eb420834a53001223cebde14eb1b4c71
 * Versión: 2026.9.23+3-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

import {TransactionManager} from "../transaction/transaction-manager";
import type {PostgreSQL} from "./index";
import type {Transaction} from "./transaction";

export class PostgreSQLTransactionManager extends TransactionManager {
    /* INSTANCE */
    public constructor(private readonly _db: PostgreSQL) {
        super();
    }

    protected get db(): PostgreSQL {
        return this._db;
    }

    public override get(): Promise<Transaction> {
        return this.db.transaction();
    }
}
