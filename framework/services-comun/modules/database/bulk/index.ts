import {Transaction} from "../transaction/transaction";

export interface BulkConfig {
    chunk?: number;
    waitToSave?: boolean;
}

export abstract class Bulk<T=any> {
    /* STATIC */

    /* INSTANCE */
    private readonly _updates: T[];
    private readonly _inserts: T[];
    private readonly _transaction?: Transaction;

    protected constructor(private readonly _config?: BulkConfig, transaction?: Transaction) {
        this._updates = [];
        this._inserts = [];
        this._transaction = transaction;
    }

    protected get config(): BulkConfig | undefined {
        return this._config;
    }

    public async run(transaction?: Transaction): Promise<void> {
        await this.doUpdates(this._updates, transaction??this._transaction);
        await this.doInserts(this._inserts, transaction??this._transaction);
    }

    public update(obj: T): void {
        if (Array.isArray(obj)) {
            for (const o of obj) {
                this.update(o);
            }
        } else {
            this._updates.push(obj);
        }
    }

    public insert(obj: T): void {
        if (Array.isArray(obj)) {
            for (const o of obj) {
                this.insert(o);
            }
        } else {
            this._inserts.push(obj);
        }
    }

    protected abstract doUpdates(updates: T[], transaction?: Transaction): Promise<void>;

    protected abstract doInserts(updates: T[], transaction?: Transaction): Promise<void>;
}
