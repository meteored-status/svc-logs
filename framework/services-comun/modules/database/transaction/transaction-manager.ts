import {ITransaction, Transaction} from "./transaction";

interface ITransactionManager {
    get(): Promise<ITransaction>;
}

export abstract class TransactionManager implements ITransactionManager {
    /* STATIC */

    /* INSTANCE */
    public abstract get(): Promise<Transaction>;
}
