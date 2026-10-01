/**
 * Editor: Bixus
 * Fecha: Wed, 23 Sep 2026 08:46:26 GMT
 * Hash: 5f448cf0acbcd5da7587e7502de9e14f
 * Versión: 2026.9.23+3-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

import {Cache, CacheBuilder as CacheBuilderBase, type ICacheConfigDefault, type ICacheDoc} from ".";
import type {ICacheDiskConfig} from "./disk";

export class MemoryCache<T> extends Cache<T>{
    /* INSTANCE */
    private readonly cache: Map<string, ICacheDoc<T>>;

    public constructor(namespace: string, cfg: Partial<ICacheConfigDefault>={}) {
        super(namespace, {
            cleanup: true,
            ...cfg,
        });

        this.cache = new Map<string, ICacheDoc<T>>();
    }

    protected async fromCache(key: string): Promise<ICacheDoc<T>|undefined> {
        return this.cache.get(key);
    }

    protected async toCache(key: string, data: ICacheDoc<T>): Promise<void> {
        this.cache.set(key, data);
    }

    protected cleanCache(key: string): void {
        this.cache.delete(key);
    }
}

class CacheBuilder extends CacheBuilderBase {
    /* INSTANCE */
    public constructor() {
        super();
    }

    protected async build<T>(namespace: string, cfg?: Partial<ICacheDiskConfig>): Promise<Cache<T>> {
        return new MemoryCache<T>(namespace, cfg);
    }
}

export default new CacheBuilder();
