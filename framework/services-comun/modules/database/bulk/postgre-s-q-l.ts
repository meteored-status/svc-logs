import {Bulk, BulkConfig} from "./index";
import {PostgreSQL} from "../postgresql";
import {Transaction} from "../postgresql/transaction";

export interface PostgreSQLBulkConfig<T> extends BulkConfig {
    query: string;
    table: string;
    getParams: (item: T) => any[];
    pk?: string[];
    duplicate?: string[];
}

export class PostgreSQLBulk<T> extends Bulk<T> {
    /* STATIC */

    /* INSTANCE */
    public constructor(private readonly db: PostgreSQL, config: PostgreSQLBulkConfig<T>, transaction?: Transaction) {
        super(config, transaction);
    }

    protected override get config(): PostgreSQLBulkConfig<T> {
        return super.config as PostgreSQLBulkConfig<T>;
    }

    protected override async doUpdates(updates: T[], transaction?: Transaction): Promise<void> {
    }

    protected override async doInserts(inserts: T[], transaction?: Transaction): Promise<void> {
        await this.db.bulkInsert(inserts.map(insert => {
            return {
                params: this.config.getParams(insert),
                query: this.config.query,
                table: this.config.table,
                duplicate: this.config.duplicate,
            }
        }), {
            transaction,
            size: this.config.chunk,
        });
    }
}
