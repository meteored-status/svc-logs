/**
 * Editor: David Martínez Moya
 * Fecha: Thu, 13 Aug 2026 09:14:19 GMT
 * Hash: 7b5bccc4d90bfdd7e9a9b04e648d4406
 * Versión: 2026.8.13+2-davidmartinezmoya
 * Proyecto: git@github.com:alpred/meteored-svc-data-alertas.git
 */

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

export interface RedisHBulkConfig<T> extends BulkConfig {
    buildKey: (item: T) => string;
    buildField: (item: T) => string;
    buildValue: (item: T) => string;
    buildTTL?: (item: T) => number|undefined;
    ttl: number;
    sharedKey?: boolean;
}

export class RedisHBulk<T> extends Bulk<T> {
    /* STATIC */

    /* INSTANCE */
    public constructor(protected readonly client: Redis, config: RedisHBulkConfig<T>) {
        super(config);
    }

    protected override get config(): RedisHBulkConfig<T> {
        return super.config as RedisHBulkConfig<T>;
    }

    protected override async doUpdates(updates: T[]): Promise<void> {
        return this.doInserts(updates);
    }

    protected override async doInserts(inserts: T[]): Promise<void> {
        await this.client.bulkHSet(inserts.map(insert => {
            return {
                key: this.config.buildKey(insert),
                field: this.config.buildField(insert),
                value: this.config.buildValue(insert),
                ttl: this.config.buildTTL?.(insert)??this.config.ttl,
                sharedKey: this.config.sharedKey,
            }
        }));
    }
}