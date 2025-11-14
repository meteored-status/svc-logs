import {PostgreSQLTransactionManager} from "../postgresql/postgre-s-q-l-transaction-manager";
import {AlloyDB} from "./index";
import {Transaction} from "./transaction";

export class AlloyDBTransactionManager extends PostgreSQLTransactionManager {
    /* STATIC */

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
