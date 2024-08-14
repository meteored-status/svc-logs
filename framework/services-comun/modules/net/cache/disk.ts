import {dirname} from "node:path";

import {
    type INetCache,
    type INetCacheV1,
    type IRequestCache,
    type IRouteGroupCache,
    NetCache,
    RequestCache,
} from "./index";
import type {Conexion} from "../conexion";
import type {RequestResponse} from "../request";
import {TDevice} from "../device";
import {md5} from "../../utiles/hash";
import {isDir, mkdir, readFileBuffer, readJSON, safeWrite} from "../../utiles/fs";

export class NetCacheDisk extends NetCache {
    /* STATIC */

    /* INSTANCE */
    public constructor(private readonly path: string = "files/tmp/netcache") {
        super();
    }

    protected cacheKey(conexion: Conexion, cfg: IRouteGroupCache): string {
        let key: string = ``;
        if (cfg.device) {
            key += `${TDevice[conexion.device]} `;
        }
        key += `${conexion.metodo} http${conexion.https?"s":""}://${conexion.url}?${conexion.query.toString()}`;

        key = md5(key);

        return `${key.substring(0, 2)}/${key}`;
    }

    protected async loadMetadata(conexion: Conexion, cfg: IRouteGroupCache): Promise<INetCache> {
        const key = `${this.path}/${this.cacheKey(conexion, cfg)}.json`;
        return await readJSON<INetCache>(key);
    }

    protected async loadData(conexion: Conexion, cfg: IRouteGroupCache): Promise<Buffer> {
        const key = `${this.path}/${this.cacheKey(conexion, cfg)}.data`;
        return readFileBuffer(key);
    }

    public async save(conexion: Conexion, cfg: IRouteGroupCache): Promise<void> {
        if (conexion.data==null) {
            return;
        }

        const cache = conexion.getCache().getTime();
        if (cache<=Date.now()) {
            return;
        }

        const respuesta = conexion.getRespuesta();
        if (respuesta.statusCode>200) {
            return;
        }

        const key = `files/tmp/netcache/${this.cacheKey(conexion, cfg)}`;
        const dir = dirname(key);
        if (!await isDir(dir)) {
            await mkdir(dir, true);
        }

        const metadatakey = `${key}.json`;
        await safeWrite(metadatakey, JSON.stringify({
            version: 1,
            expires: cache,
            code: respuesta.statusCode,
            headers: {
                ...conexion.responseHeaders,
                "X-Meteored-Cache": "HIT",
            },
        } as INetCacheV1), true);

        const datakey = `${key}.data`;
        await safeWrite(datakey, conexion.data, true);
    }
}

export class RequestCacheDisk extends RequestCache {
    /* STATIC */

    /* INSTANCE */
    public constructor(private readonly path: string = "files/tmp/requestcache") {
        super();
    }

    protected cacheKey(url: string): string {
        const key = md5(url);

        return `${key.substring(0, 2)}/${key}`;
    }

    protected async loadMetadata(url: string): Promise<IRequestCache> {
        const key = `${this.path}/${this.cacheKey(url)}.json`;
        return await readJSON<IRequestCache>(key);
    }

    protected async loadData(url: string): Promise<Buffer> {
        const key = `${this.path}/${this.cacheKey(url)}.data`;
        return readFileBuffer(key);
    }

    public async save(url: string, data: RequestResponse<Buffer>): Promise<void> {
        if (data.expires==undefined || data.expires.getTime()<=Date.now()) {
            return;
        }

        const key = `files/tmp/netcache/${this.cacheKey(url)}`;
        const dir = dirname(key);
        if (!await isDir(dir)) {
            await mkdir(dir, true);
        }

        const metadatakey = `${key}.json`;
        await safeWrite(metadatakey, JSON.stringify({
            version: 1,
            expires: data.expires,
            headers: data.headers,
        }), true);

        const datakey = `${key}.data`;
        await safeWrite(datakey, data.data, true);
    }
}
