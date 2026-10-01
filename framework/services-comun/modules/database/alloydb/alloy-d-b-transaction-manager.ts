/**
 * Editor: Bixus
 * Fecha: Wed, 23 Sep 2026 08:46:25 GMT
 * Hash: d60d3e47e3e4dc91611b42f92d64b4f7
 * Versión: 2026.9.23+3-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

import {PostgreSQLTransactionManager} from "../postgresql/postgre-s-q-l-transaction-manager";
import type {AlloyDB} from "./index";
import type {Transaction} from "./transaction";

export class AlloyDBTransactionManager extends PostgreSQLTransactionManager {
    /* INSTANCE */
    public constructor(db: AlloyDB) {
        super(db);
    }

    protected override get db(): AlloyDB {
        return super.db as AlloyDB;
    }

    public override get(): Promise<Transaction> {
        return super.db.transaction() as Promise<Transaction>;
    }
}
