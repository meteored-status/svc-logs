import {INetCache, INetCacheV1, IRouteGroupCache, NetCache} from "./index";
import {Conexion} from "../conexion";
import {IRedisOptions, Redis} from "../../database/redis";
import {Configuracion} from "../../utiles/config";
import {md5} from "../../utiles/hash";
import {TDevice} from "../device";

export class NetCacheRedis extends NetCache {
    /* STATIC */
    private static REDIS_CLIENT: Redis|null = null;

    private static redis(config: Configuracion, credenciales?: string, options?: IRedisOptions): Redis {
        if (!this.REDIS_CLIENT) {
            this.REDIS_CLIENT = Redis.build({
                pod: config.pod,
                credenciales,
                ...options,
            });
        }
        return this.REDIS_CLIENT;
    }

    /* INSTANCE */
    public constructor(private readonly config: Configuracion, private readonly credenciales?: string, private readonly options?: IRedisOptions) {
        super();
    }

    private cacheKey(conexion: Conexion, cfg: IRouteGroupCache): string {
        let key: string = '';
        if (cfg.device) {
            key += `${TDevice[conexion.device]} `;
        }
        key += `${conexion.metodo} http${conexion.https?"s":""}://${conexion.url}?${conexion.query.toString()}`;

        key = md5(key);

        return `netcache:${key}`;
    }

    protected async loadMetadata(conexion: Conexion, cfg: IRouteGroupCache): Promise<INetCache> {
        const key = `${this.cacheKey(conexion, cfg)}:metadata`;
        const redis = NetCacheRedis.redis(this.config, this.credenciales, this.options);
        const metadata = await redis.loadJSON<INetCache>(key) as INetCacheV1|null;

        if (!metadata) {
            return Promise.reject("No hay metadatos en caché");
        }

        return metadata;
    }

    protected async loadData(conexion: Conexion, cfg: IRouteGroupCache): Promise<Buffer> {
        const key = `${this.cacheKey(conexion, cfg)}:data`;
        const redis = NetCacheRedis.redis(this.config, this.credenciales, this.options);
        const data = await redis.get(key) as Buffer|null;
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

        const redis = NetCacheRedis.redis(this.config, this.credenciales, this.options);

        const key = this.cacheKey(conexion, cfg);

        const metadatakey = `${key}:metadata`;
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

        await redis.saveJSON(metadatakey, metadata, {
            ttl,
        });

        const datakey = `${key}:data`;
        await redis.set(datakey, conexion.data, {
            ttl,
        });
    }
}
