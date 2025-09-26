import {ITransaction, Transaction} from "./transaction";

interface ITransactionManager {
    get(): Promise<ITransaction>;
}

export abstract class TransactionManager {
    /* STATIC */

    /* INSTANCE */
    public abstract get(): Promise<Transaction>;
}
