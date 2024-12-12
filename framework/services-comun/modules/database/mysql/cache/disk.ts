import {stringify, parse} from "@ungap/structured-clone/json";

import {Cache, CacheBuilder as CacheBuilderBase, ICacheBuilder, type ICacheConfigDefault, type ICacheDoc} from ".";
import type {TipoRegistro} from "../index";
import {error} from "../../../utiles/log";
import {isFile, mkdir, readFileString, safeWrite, unlink} from "../../../utiles/fs";
import {md5} from "../../../utiles/hash";
import mock from "./mock";

export interface ICacheDiskConfig extends ICacheConfigDefault {
    path: string;
}

export class DiskCache<T> extends Cache<T>{
    /* INSTANCE */
    protected readonly md5: string;
    protected path: string;

    public constructor(sql: string, {path="tmp", ...cfg}: Partial<ICacheDiskConfig>={}) {
        super(sql, {
            cleanup: false,
            ...cfg,
        });

        this.md5 = md5(sql);
        this.path = `files/${path}/${this.md5}/`;
    }

    public async init(): Promise<DiskCache<T>> {
        await mkdir(this.path, true);
        if (!await isFile(`${this.path}/.sql`)) {
            await safeWrite(`${this.path}/.sql`, this.sql);
        }

        return this;
    }

    // public override update({path, ...cfg}: Partial<ICacheDiskConfig>): void {
    //     super.update(cfg);
    //
    //     if (path!=undefined) {
    //         this.path = `files/${path}/${this.md5}/`;
    //     }
    // }

    protected override generateKey(params: TipoRegistro[]): string {
        return md5(super.generateKey(params));
    }

    protected getFile(key: string): string {
        return `${this.path}${key}`;
    }

    protected async fromCache(key: string): Promise<ICacheDoc<T>|undefined> {
        const file = this.getFile(key);
        try {
            if (await isFile(file)) {
                return parse(await readFileString(file)) as ICacheDoc<T>;
            }
        } catch (err) {
            if (err instanceof Error) {
                error(`Error al leer el archivo de cache: ${file}`, err.message);

            } else {
                error(`Error al leer el archivo de cache: ${file}`, JSON.stringify(err));
            }
        }

        return undefined;

    }

    protected async toCache(key: string, data: ICacheDoc<T>): Promise<void> {
        const file = this.getFile(key);
        try {
            await safeWrite(file, stringify(data), true);
        } catch (err) {
            if (err instanceof Error) {
                error(`Error al escribir el archivo de cache: ${file}`, err.message);
            } else {
                error(`Error al escribir el archivo de cache: ${file}`, JSON.stringify(err));
            }
        }
    }

    protected cleanCache(key: string): void {
        const file = this.getFile(key);
        isFile(file)
            .then((exists) => {
                if (exists) {
                    return unlink(file);
                }
                return Promise.resolve();
            })
            .catch((err) => {
                if (err instanceof Error) {
                    error(`Error al eliminar el archivo de cache: ${file}`, err.message);
                } else {
                    error(`Error al eliminar el archivo de cache: ${file}`, JSON.stringify(err));
                }
            });
    }
}

class CacheBuilder extends CacheBuilderBase {
    /* INSTANCE */
    public constructor() {
        super();
    }

    protected async build<T>(namespace: string, cfg?: Partial<ICacheDiskConfig>): Promise<Cache<T>> {
        return new DiskCache<T>(namespace, cfg).init()
            .catch((err)=>{
                if (err instanceof Error) {
                    error(`Error al inicializar el cache de disco: ${namespace}`, err.message);
                } else {
                    error(`Error al inicializar el cache de disco: ${namespace}`, JSON.stringify(err));
                }

                return mock.get<T>();
            });
    }

    public override config(cfg: Partial<ICacheDiskConfig>): ICacheBuilder {
        return super.config(cfg);
    }
}

export default new CacheBuilder();



// public async get2(cfg: ICacheConfigDefault) {
//
// }
