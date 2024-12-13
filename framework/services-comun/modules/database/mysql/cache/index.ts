import type {TipoRegistro} from "..";
import {error} from "../../../utiles/log";
import {PromiseDelayed} from "../../../utiles/promise";
import {ICacheDiskConfig} from "./disk";

type QueryFailover<T> = (sql: string, params: TipoRegistro[])=>Promise<T[]>;

export interface ICacheConfigDefault {
    cleanup: boolean;
}

interface ICacheConfigGet extends Partial<ICacheConfigDefault> {
    expires?: Date;
    key?: string|number;
    ttl?: number;
}

export interface ICacheConfig extends ICacheConfigGet {
    builder: ICacheBuilder;
}

export interface ICacheDoc<T> {
    date: Date;
    ttl?: number;
    expires?: Date;
    docs: T[];
}

export interface ICache<T> {
    get: (sql: string, params: TipoRegistro[], fn: QueryFailover<T>, cfg?: ICacheConfigGet) => Promise<T[]>;
}

export abstract class Cache<T> implements ICache<T> {
    /* INSTANCE */
    protected cleanup: boolean;

    private readonly running: Record<string, Promise<T[]>>;

    protected constructor(protected readonly sql: string, {cleanup}: ICacheConfigDefault) {
        this.cleanup = cleanup;
        this.running = {};
    }

    public update({cleanup = this.cleanup}: Partial<ICacheConfigDefault>): void {
        this.cleanup = cleanup;
    }

    protected generateKey(params: TipoRegistro[]): string {
        return JSON.stringify(params);
    }

    public get(sql: string, params: TipoRegistro[], fn: QueryFailover<T>, cfg: ICacheConfigGet = {}): Promise<T[]> {
        const key = cfg.key ?? this.generateKey(params);

        return this.running[key] ??= this.getEjecutar(`${key}`, sql, params, fn, cfg);
    }

    private async getEjecutar(key: string, sql: string, params: TipoRegistro[], fn: QueryFailover<T>, cfg: ICacheConfigGet): Promise<T[]> {
        // const time = Date.now();
        let data = await this.fromCache(key);
        if (data!=undefined && this.checkCache(data)) {
            // error("SI", Date.now()-time);
            delete this.running[key];
            return data.docs;
        }

        const docs = await fn(sql, params);

        PromiseDelayed()
            .then(()=>this.cachear(key, cfg, docs))
            .finally(()=>{
                delete this.running[key];
            });
        // error("NO", Date.now()-time);

        return docs;
    }

    private async cachear(key: string, {ttl, expires, cleanup}: ICacheConfigGet, docs: T[]): Promise<void> {
        const data: ICacheDoc<T> = {
            date: new Date(),
            ttl,
            expires,
            docs,
        };

        let delay: number|undefined;
        if (data.ttl!=undefined) {
            delay = data.ttl;
        }
        if (data.expires!=undefined) {
            delay = data.expires.getTime()-Date.now();
        }
        if (delay!=undefined) {
            if (delay <= 0) {
                return;
            }

            if (cleanup ?? this.cleanup) {
                setTimeout(() => {
                    this.cleanCache(key);
                }, delay);
            }
        }

        try {
            await this.toCache(key, data)
        } catch (err) {
            // normalmente los errores se tratan en la implementación del toCache
            if (err instanceof Error) {
                error(`Error al guardar en cache:`, err.message);
            } else {
                error(`Error al guardar en cache:`, JSON.stringify(err));
            }
        }
    }

    protected checkCache(doc: ICacheDoc<T>): boolean {
        if (doc.ttl!=undefined) {
            const ttl = Date.now() - doc.date.getTime();
            return ttl>=0 && ttl<doc.ttl;
        }
        if (doc.expires!=undefined) {
            return doc.expires.getTime()>=Date.now();
        }

        return true;
    }

    protected abstract fromCache(key: string): Promise<ICacheDoc<T>|undefined>;
    protected abstract toCache(key: string, data: ICacheDoc<T>): Promise<void>;
    protected abstract cleanCache(key: string): void;
}

export interface ICacheBuilder {
    get<T>(sql: string, cfg?: Partial<ICacheDiskConfig>): Promise<Cache<T>>;
}

export abstract class CacheBuilder implements ICacheBuilder {
    /* INSTANCE */
    private sqls: Map<string, Cache<any>>;

    protected constructor() {
        this.sqls = new Map<string, Cache<any>>();
    }

    public async get<T>(sql: string, cfg?: Partial<ICacheDiskConfig>): Promise<Cache<T>> {
        const cache = this.sqls.get(sql);
        if (cache!=undefined) {
            if (cfg!=undefined) {
                cache.update(cfg);
            }
            return cache as Cache<T>;
        }

        const nuevo = await this.build<T>(sql, cfg);
        this.sqls.set(sql, nuevo);

        return nuevo;
    }

    public config(cfg: Partial<ICacheDiskConfig>): ICacheBuilder {
        return {
            get: (sql: string)=>this.get(sql, cfg),
        };
    }

    protected abstract build<T>(namespace: string, cfg?: Partial<ICacheDiskConfig>): Promise<Cache<T>>;
}
