import {type INetCache, INetCacheV1, type IRouteGroupCache, NetCache} from "./index";
import type {Conexion} from "../conexion";
import {TDevice} from "../device";
import {md5} from "../../utiles/hash";

export class NetCacheMemory extends NetCache {
    /* STATIC */
    private static CACHE_DATA: Record<string, Buffer> = {};
    private static CACHE_METADATA: Record<string, INetCacheV1> = {};

    /* INSTANCE */
    public constructor() {
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
        const key = `${this.cacheKey(conexion, cfg)}:metadata`;
        const metadata = NetCacheMemory.CACHE_METADATA[key];
        if (!metadata) {
            return Promise.reject("No hay metadatos en caché");
        }
        return metadata;
    }

    protected async loadData(conexion: Conexion, cfg: IRouteGroupCache): Promise<Buffer> {
        const key = `${this.cacheKey(conexion, cfg)}:data`;
        const data = NetCacheMemory.CACHE_DATA[key];
        if (!data) {
            return Promise.reject("No hay datos en caché");
        }
        return data;
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

        const key = this.cacheKey(conexion, cfg);

        const metadataKey = `${key}:metadata`;
        const datakey = `${key}:data`;

        const metadata: INetCacheV1 = {
            version: 1,
            expires: cache,
            code: respuesta.statusCode,
            headers: {
                ...conexion.responseHeaders,
                "X-Meteored-Cache": "HIT",
            },
        };
        const ttl = Math.ceil((cache - Date.now()) / 1000);

        if (ttl <= 0) {
            return;
        }

        NetCacheMemory.CACHE_METADATA[metadataKey] = metadata;
        NetCacheMemory.CACHE_DATA[datakey] = conexion.data;
    }
}
