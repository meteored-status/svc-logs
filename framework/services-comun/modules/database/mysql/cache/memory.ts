import {Cache, CacheBuilder as CacheBuilderBase, type ICacheConfigDefault, type ICacheDoc} from ".";
import {ICacheDiskConfig} from "./disk";

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
