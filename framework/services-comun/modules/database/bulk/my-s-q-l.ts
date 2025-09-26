import {Bulk, BulkConfig} from "./index";
import {MySQL as MySQLConnectionPool} from "../mysql"
import {Transaction} from "../mysql/transaction";

export interface MySQLBulkConfig<T> extends BulkConfig {
    query: string;
    table: string;
    getParams: (item: T) => any[];
    duplicate?: string[];
}

export class MySQL<T> extends Bulk<T> {
    /* STATIC */

    /* INSTANCE */
    public constructor(private readonly db: MySQLConnectionPool, config: MySQLBulkConfig<T>, transaction?: Transaction) {
        super(config, transaction);
    }

    protected override get config(): MySQLBulkConfig<T> {
        return super.config as MySQLBulkConfig<T>;
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
