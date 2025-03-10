import {TransactionManager} from "../transaction/transaction-manager";
import {GoogleCloudTransaction} from "./google-cloud-transaction";

export class GoogleCloudTransactionManager extends TransactionManager {
    /* STATIC */

    /* INSTANCE */
    public constructor() {
        super();
    }

    public override get(): Promise<GoogleCloudTransaction> {
        return Promise.resolve(new GoogleCloudTransaction());
    }
}