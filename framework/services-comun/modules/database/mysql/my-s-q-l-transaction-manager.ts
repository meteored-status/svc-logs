import {MySQL} from "./index";
import {TransactionManager} from "../transaction/transaction-manager";
import {Transaction} from "./transaction";

export class MySQLTransactionManager extends TransactionManager {
    /* STATIC */

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
