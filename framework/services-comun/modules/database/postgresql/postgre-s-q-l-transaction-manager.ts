import {TransactionManager} from "../transaction/transaction-manager";
import {PostgreSQL} from "./index";
import {Transaction} from "./transaction";

export class PostgreSQLTransactionManager extends TransactionManager {
    /* STATIC */

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
