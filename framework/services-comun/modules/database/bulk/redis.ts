import {Bulk, BulkConfig} from "./";
import {Redis} from "../redis";

export interface RedisBulkConfig<T> extends BulkConfig {
    buildKey: (item: T) => string;
    buildValue: (item: T) => string;
    buildTTL?: (item: T) => number|undefined;
    ttl: number;
    sharedKey?: boolean;
}

export class RedisBulk<T> extends Bulk<T> {
    /* STATIC */

    /* INSTANCE */
    public constructor(private readonly client: Redis, config: RedisBulkConfig<T>) {
        super(config);
    }

    protected override get config(): RedisBulkConfig<T> {
        return super.config as RedisBulkConfig<T>;
    }

    protected override async doUpdates(updates: T[]): Promise<void> {
        return this.doInserts(updates);
    }

    protected override async doInserts(inserts: T[]): Promise<void> {
        await this.client.bulkSet(inserts.map(insert => {
            return {
                key: this.config.buildKey(insert),
                value: this.config.buildValue(insert),
                ttl: this.config.buildTTL?.(insert)??this.config.ttl,
                sharedKey: this.config.sharedKey,
            }
        }));
    }
}
