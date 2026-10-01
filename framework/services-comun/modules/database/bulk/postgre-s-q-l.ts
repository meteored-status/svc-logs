/**
 * Editor: Bixus
 * Fecha: Wed, 23 Sep 2026 08:46:25 GMT
 * Hash: 61d77450e48ecd30db863505d307dd63
 * Versión: 2026.9.23+3-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

import type {BulkConfig} from "./index";
import {Bulk} from "./index";
import type {PostgreSQL} from "../postgresql";
import type {Transaction} from "../postgresql/transaction";

export interface PostgreSQLBulkConfig<T> extends BulkConfig {
    query: string;
    table: string;
    getParams: (item: T) => any[];
    pk?: string[];
    duplicate?: string[];
}

export class PostgreSQLBulk<T> extends Bulk<T> {
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
                pk: this.config.pk,
            }
        }), {
            transaction,
            size: this.config.chunk,
        });
    }
}
