/**
 * Editor: Bixus
 * Fecha: Wed, 23 Sep 2026 08:46:25 GMT
 * Hash: 49d96c64e53b9b4c663196edd3debbbb
 * Versión: 2026.9.23+3-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

import type {BulkConfig} from "./index";
import {Bulk} from "./index";
import type {MySQL as MySQLConnectionPool} from "../mysql"
import type {Transaction} from "../mysql/transaction";

export interface MySQLBulkConfig<T> extends BulkConfig {
    query: string;
    table: string;
    getParams: (item: T) => any[];
    duplicate?: string[];
}

export class MySQL<T> extends Bulk<T> {
    /* INSTANCE */
    public constructor(private readonly db: MySQLConnectionPool, config: MySQLBulkConfig<T>, transaction?: Transaction) {
        super(config, transaction);
    }

    protected override get config(): MySQLBulkConfig<T> {
        return super.config as MySQLBulkConfig<T>;
    }

    protected override async doUpdates(updates: T[], transaction?: Transaction): Promise<void> {
        return this.doInserts(updates, transaction);
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
