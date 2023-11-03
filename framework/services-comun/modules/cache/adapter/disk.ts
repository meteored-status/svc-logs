import path from "node:path";

import {CacheAdapter, ICacheAdapter, ICacheGetOptions, ICacheMetadata, ICacheSetOptions} from "../adapter";
import {exists, mkdir, readFile, readJSON, safeWrite} from "../../utiles/fs";
import {info} from "../../utiles/log";

export class CacheAdapterDisk<T extends ICacheMetadata> extends CacheAdapter<T>{
    /* STATIC */


    /* INSTANCE */
    private async isCacheOK(control: string): Promise<T> {
        const cacheControlFile = `${this.config.dir}/${control}.json`;
        const data = await readJSON<T>(cacheControlFile);
        if (data.borrada) {
            return Promise.reject("Caché expirada");
        }

        if (data.subcache!=undefined && data.subcache.length>0) {
            const promesas: Promise<ICacheMetadata>[] = [];
            for (const actual of data.subcache) {
                promesas.push(this.isCacheOK(actual));
            }
            await Promise.all(promesas);
        }

        return data;
    }

    public async get({key, control}: ICacheGetOptions): Promise<ICacheAdapter<T>> {
        if (this.config.enabled) {
            const cacheContentFile = `${this.config.dir}/${key}.data`;

            const [, data, contenido] = await Promise.all([
                this.isCacheOK(control??key),
                this.isCacheOK(key),
                readFile(cacheContentFile).then(data=>data.toString("utf-8")),
            ]);

            if (data.expiracion!=undefined) {
                const expiracionDate = new Date(data.expiracion);
                if (expiracionDate.getTime()<Date.now()) {
                    return Promise.reject("Caché expirada");
                }
            }
            return {
                value: contenido,
                metadata: data,
            };
        }

        return Promise.reject("Caché desactivada");
    }

    public async set({key, control, value, metadata}: ICacheSetOptions, retry: number = 0): Promise<void> {
        if (this.config.enabled) {
            const cacheControlFile1 = `${this.config.dir}/${control??key}.json`;
            const cacheControlFile2 = `${this.config.dir}/${key}.json`;
            const cacheContentFile = `${this.config.dir}/${key}.data`;
            await Promise.all([
                safeWrite(cacheContentFile, value, true, true),
                safeWrite(cacheControlFile1, JSON.stringify(metadata), true, true),
                ...(cacheControlFile1!=cacheControlFile2?
                    [safeWrite(cacheControlFile2, JSON.stringify(metadata), true, true).then(async ()=>{})]:
                    []),
            ]).catch(async (err)=>{
                if (retry<10) {
                    const dirNameControl1 = path.dirname(cacheControlFile1);
                    const dirNameControl2 = path.dirname(cacheControlFile2);
                    const dirNameContent = path.dirname(cacheContentFile);
                    if (!await exists(dirNameControl1)) {
                        // info("Creando directorio de caché", dirNameControl1);
                        await mkdir(dirNameControl1, true);
                    }
                    if (dirNameControl1!=dirNameControl2 && !await exists(dirNameControl2)) {
                        // info("Creando directorio de caché", dirNameControl2);
                        await mkdir(dirNameControl2, true);
                    }
                    if (dirNameContent!=dirNameControl1 && dirNameContent!=dirNameControl2 && !await exists(dirNameContent)) {
                        info("Creando directorio de caché", dirNameContent);
                        await mkdir(dirNameContent, true);
                    }
                    return this.set({control, key, value, metadata}, retry + 1);
                }
                return Promise.reject(err);
            });
        }
    }
}
