import type {Conexion} from "@mr/core-network/server/http/conexion";
import {TDevice} from "@mr/core-network/server/http/config/device";

import type {Configuracion, IPodInfo} from "../../utiles/config";
import {type INetCache, type INetCacheV1, type IRequestCache, type IRouteGroupCache, NetCache, RequestCache} from ".";
import {type IValkeyOptions, ValKey} from "../../database/valkey";
import {md5} from "../../utiles/hash";
import type {RequestResponse} from "../request-backend";

export class NetCacheValKey extends NetCache {
    /* STATIC */
    private static VALKEY_CLIENT?: ValKey;
    private static async valkey(config: Configuracion, credenciales?: string, options?: IValkeyOptions): Promise<ValKey> {
        if (!this.VALKEY_CLIENT) {
            this.VALKEY_CLIENT = ValKey.build({pod: config.pod, credenciales, options});
        }
        return this.VALKEY_CLIENT;
    }

    /* INSTANCE */
    public constructor(private readonly config: Configuracion, private readonly credenciales?: string, private readonly options?: IValkeyOptions) {
        super();
        // no necesitamos construir nada
    }

    private cacheKey(conexion: Conexion, cfg: IRouteGroupCache): string {
        let key = "";
        if (cfg.device) {
            key += `${TDevice[conexion.device]} `;
        }
        key += `${conexion.metodo} http${conexion.https?"s":""}://${conexion.url}?${conexion.query.toString()}`;

        return `netcache:${md5(key)}`;
    }

    protected async loadMetadata(conexion: Conexion, cfg: IRouteGroupCache): Promise<INetCache> {
        const key = `${this.cacheKey(conexion, cfg)}:metadata`;
        const valkey = await NetCacheValKey.valkey(this.config, this.credenciales, this.options);
        const metadata = await valkey.loadJSON<INetCache>(key) as INetCacheV1|null;

        if (!metadata) {
            return Promise.reject("No hay metadatos en caché");
        }

        return metadata;
    }

    protected async loadData(conexion: Conexion, cfg: IRouteGroupCache): Promise<Buffer> {
        const key = `${this.cacheKey(conexion, cfg)}:data`;
        const valkey = await NetCacheValKey.valkey(this.config, this.credenciales, this.options);
        const data = await valkey.get(key);
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

        const valkey = await NetCacheValKey.valkey(this.config, this.credenciales, this.options);

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

        await valkey.saveJSON(metadatakey, metadata, {
            ttl,
        });

        const datakey = `${key}:data`;
        await valkey.set(datakey, conexion.data, {
            ttl,
        });
    }
}

export class RequestCacheValkey extends RequestCache {
    /* STATIC */
    private static VALKEY_CLIENT?: ValKey;
    private static async valkey(pod: IPodInfo, credenciales?: string, options?: IValkeyOptions): Promise<ValKey> {
        if (!this.VALKEY_CLIENT) {
            this.VALKEY_CLIENT = ValKey.build({pod, credenciales, options});
        }
        return this.VALKEY_CLIENT;
    }

    /* INSTANCE */
    public constructor(protected readonly pod: IPodInfo, private readonly credenciales?: string, private readonly options?: IValkeyOptions) {
        super();
        // no necesitamos construir nada
    }

    protected cacheKey(url: string): string {
        return `requestcache:${md5(url)}`;
    }

    protected async loadMetadata(url: string): Promise<IRequestCache> {
        const key = `${this.cacheKey(url)}:metadata`;
        const cliente = await RequestCacheValkey.valkey(this.pod, this.credenciales, this.options);

        const salida = await cliente.loadJSON<IRequestCache>(key);
        if (!salida) {
            return Promise.reject(new Error("No cached data"));
        }

        return salida;
    }

    protected async loadData(url: string): Promise<Buffer> {
        const key = `${this.cacheKey(url)}:data`;
        const cliente = await RequestCacheValkey.valkey(this.pod, this.credenciales, this.options);

        const salida = await cliente.get(key);
        if (!salida) {
            return Promise.reject(new Error("No cached data"));
        }
        return salida;
    }

    public async save(url: string, data: RequestResponse<Buffer>): Promise<void> {
        if (data.expires===undefined || data.expires.getTime()<=Date.now()) {
            return;
        }

        const cliente = await RequestCacheValkey.valkey(this.pod, this.credenciales, this.options);

        const metadatakey = `${this.cacheKey(url)}:metadata`;

        await cliente.saveJSON(metadatakey, {
            version: 1,
            expires: data.expires,
            headers: data.headers,
        });

        const datakey = `${this.cacheKey(url)}:data`;
        await cliente.set(datakey, data.data, {ttl: data.expires.getTime()-Date.now()});
    }
}
