/**
 * Editor: Bixus
 * Fecha: Wed, 23 Sep 2026 08:46:25 GMT
 * Hash: 6b1fcda56cb3e4442a76be4359e434c9
 * Versión: 2026.9.23+3-bixus
 * Anterior: 2026.9.2+2-juancmartinez
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

import {arrayChop} from "../../utiles/array";
import type {BulkConfig} from "./";
import {Bulk} from "./";
import type {Redis} from "../redis";

export interface RedisBulkConfig<T> extends BulkConfig {
    buildKey: (item: T) => string;
    buildValue: (item: T) => string;
    buildTTL?: (item: T) => number|undefined;
    ttl: number;
    sharedKey?: boolean;
}

export class RedisBulk<T> extends Bulk<T> {
    /* STATIC */

    // Cada item de RedisBulk encola 2 comandos (SET + EXPIRE), así que un lote son ~10000
    // comandos por MULTI. Como EXEC es atómico, el servidor no intercala nada más mientras lo
    // ejecuta: subir más penaliza a los lectores concurrentes sin ahorrar apenas viajes.
    public static readonly CHUNK_DEFECTO: number = 5000;

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
        if (inserts.length === 0) {
            return;
        }

        for (const lote of arrayChop(inserts, this.config.chunk??RedisBulk.CHUNK_DEFECTO)) {
            await this.client.bulkSet(lote.map(insert => {
                return {
                    key: this.config.buildKey(insert),
                    value: this.config.buildValue(insert),
                    ttl: this.config.buildTTL?.(insert)??this.config.ttl,
                    sharedKey: this.config.sharedKey,
                }
            }));
        }
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
        if (inserts.length === 0) {
            return;
        }

        for (const lote of arrayChop(inserts, this.config.chunk??RedisBulk.CHUNK_DEFECTO)) {
            await this.client.bulkHSet(lote.map(insert => {
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
}