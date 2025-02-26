import {TransactionManager} from "../transaction-manager";
import {FakeTransaction} from "./fake-transaction";

export class FakeTransactionManager extends TransactionManager {
    /* STATIC */

    /* INSTANCE */
    public constructor() {
        super();
    }

    public override get(): Promise<FakeTransaction> {
        return Promise.resolve(new FakeTransaction());
    }
}