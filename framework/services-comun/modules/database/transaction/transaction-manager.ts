/**
 * Editor: Bixus
 * Fecha: Wed, 23 Sep 2026 08:46:26 GMT
 * Hash: 0de58367283382f657c7ce8c4fab4045
 * Versión: 2026.9.23+3-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

import type {ITransaction, Transaction} from "./transaction";

interface ITransactionManager {
    get(): Promise<ITransaction>;
}

export abstract class TransactionManager implements ITransactionManager {
    /* INSTANCE */
    public abstract get(): Promise<Transaction>;
}
