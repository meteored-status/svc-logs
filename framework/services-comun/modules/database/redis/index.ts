import process from "node:process";
import {error, info, warning} from "../../utiles/log";
import {createClient, type RedisClientType} from "redis";
import {PromiseTimeout} from "../../utiles/promise";
import {IPodInfo} from "../../utiles/config";
import {readJSON} from "../../utiles/fs";

interface IRedisBuild {
    pod: IPodInfo;
    credenciales?: string;
    options?: IRedisOptions;
}

type IRedisHost = {
    host: string
    port: string;
}

export type IRedisOptions = {
    timeout?: number;
}

type IRedis = IRedisHost;

type IRedisCluster = {
    primary: IRedis;
    read?: IRedis;
}

type QueryOptions = {
    shared?: boolean;
}

type SaveOptions = QueryOptions & {
    ttl?: number; // seconds
}

type IInsert = {
    key: string;
    value: string;
    ttl: number;
    sharedKey?: boolean;
}

export class Redis implements Disposable {
    /* STATIC */

    private static readonly MAX_REDIS_GET_CLIENT_MS: number = 50;
    private static readonly MAX_REDIS_GET_MS: number = 10;

    public static build({pod, credenciales = 'files/credenciales/redis.json', options}: IRedisBuild): Redis {
        return new this(pod, credenciales, options);
    }

    /* INSTANCE */
    private _cluster?: Promise<RedisCluster>;
    private constructor(
        protected readonly config: IPodInfo,
        private readonly credenciales: string,
        private readonly options: IRedisOptions = {}
    ) {
    }

    public [Symbol.dispose](): void {
        if (this._cluster) {
            this._cluster.then(cluster => {
                cluster[Symbol.dispose]();
            });
            info(`Desconectado de REDIS (cluster)`);
        }
    }

    private get cluster(): Promise<RedisCluster> {
        if (!this._cluster) {
            this._cluster = readJSON<IRedis|IRedisCluster>(this.credenciales).then(data => {
                let primary: IRedis;
                let read: IRedis|undefined;

                if ("primary" in data) {
                    primary = data.primary;

                    if ("read" in data) {
                        read = data.read;
                    } else {
                        read = undefined;
                    }
                } else {
                    primary = data;
                }

                return new RedisCluster(primary, read);
            });
        }
        return this._cluster;
    }

    public async get(key: string|string[], {shared}: QueryOptions = {}): Promise<Buffer|Buffer[]|null> {
        try {
            const cluster = await this.cluster;
            const client = await PromiseTimeout(cluster.read, Redis.MAX_REDIS_GET_CLIENT_MS);

            if (Array.isArray(key)) {
                const theKeys = key.map(k => this.buildKey(k, shared||false));

                const multi = client.multi();
                theKeys.forEach(k => multi.get(k));

                const data = await PromiseTimeout(multi.exec(), this.options.timeout||Redis.MAX_REDIS_GET_MS);
                return data.map(item => !!item ? Buffer.from(item as unknown as string, 'utf-8') : null) as Buffer[];
            } else {
                const theKey = this.buildKey(key, shared||false);

                const data: string|null = await PromiseTimeout(client.get(theKey), this.options.timeout||Redis.MAX_REDIS_GET_MS) as string|null;
                if (data) {
                    return Buffer.from(data, 'utf-8');
                }
            }
        } catch (e) {
            warning(`Error obteniendo ${key} de REDIS`, e);
        }
        return null;
    }

    public async set(key: string, data: Buffer, {shared, ttl}: SaveOptions = {}): Promise<void> {
        try {
            const cluster = await this.cluster;

            const client = await PromiseTimeout(cluster.primary, Redis.MAX_REDIS_GET_CLIENT_MS);

            const theKey = this.buildKey(key, shared||false);

            const multi = client.multi()
                .set(theKey, data.toString('utf-8'))
            ;

            if (ttl !== undefined && ttl>=0) {
                multi.expire(theKey, ttl);
            }

            await multi.exec();
        } catch (e) {
            warning(`Error guardando ${key} en REDIS`, e);
        }
    }

    public async loadJSON<T=any>(key: string|string[], {shared}: QueryOptions = {}): Promise<T|T[]|null> {
        const data = await this.get(key, {shared});

        if (data) {
            if (Array.isArray(data)) {
                // Si es un array, devolvemos el primero que no sea null
                return data.map(aData => JSON.parse(aData.toString('utf-8')) as T);
            }
            return JSON.parse(data.toString('utf-8')) as T;
        }
        return null;
    }

    public async saveJSON(key: string, data: any, {shared, ttl}: SaveOptions = {}): Promise<void> {
        await this.set(key, Buffer.from(JSON.stringify(data), 'utf-8'), {shared, ttl});
    }

    public async bulkSet(items: IInsert[]): Promise<void> {
        const cluster = await this.cluster;

        const client = await cluster.primary;

        const multi = client.multi();

        for (const item of items) {
            const theKey = this.buildKey(item.key, item.sharedKey??false);
            multi.set(theKey, item.value);

            if (item.ttl !== undefined && item.ttl>=0) {
                multi.expire(theKey, item.ttl);
            }
        }

        await multi.exec();
    }

    public async searchKeys(pattern: string, {shared}: QueryOptions = {}): Promise<string[]> {
        try {
            const cluster = await this.cluster;

            const client = await PromiseTimeout(cluster.read, Redis.MAX_REDIS_GET_CLIENT_MS);

            return await client.keys(this.buildKey(pattern, shared??false));
        } catch (e) {
            warning(`Error buscando keys con patrón ${pattern} en REDIS`, e);
        }
        return [];
    }

    private buildKey(key: string, shared: boolean) {
        if (shared) {
            return key;
        }
        const namespace = (process.env['K8S_NAMESPACE']??'default').replace('meteored','mr');
        return `${namespace}:${this.config.servicio}:${key}`;
    }
}


class RedisCluster implements Disposable {
    /* STATIC */
    private static readonly MAX_RECONNECT_TRIES: number = 3;

    /* INSTANCE */
    private _primaryClient?: Promise<RedisClientType>|null;
    private _readClient?: Promise<RedisClientType>|null;
    public constructor(private readonly _primary: IRedis, private readonly _read?: IRedis) {
    }

    public [Symbol.dispose](): void {
        if (this._primaryClient) {
            this._primaryClient.then(client => {
                client.quit();
                info(`Desconectado de REDIS (primary)`);
            });
        }
        if (this._readClient && this._readClient !== this._primaryClient) {
            this._readClient.then(client => {
                client.quit();
                info(`Desconectado de REDIS (read)`);
            });
        }
    }

    private async disconnectPrimary(): Promise<void> {
        if (this._primaryClient) {
            const includeRead = this._readClient && this._readClient === this._primaryClient;
            const client = await this._primaryClient;
            await client.quit();
            info(`Desconectado de REDIS (primary)`);
            this._primaryClient = undefined;

            if (includeRead) {
                await this.disconnectRead();
            }
        }
    }

    private async disconnectRead(): Promise<void> {
        if (this._readClient) {
            const client = await this._readClient;
            await client.quit();
            info(`Desconectado de REDIS (read)`);
            this._readClient = undefined;
        }
    }

    public get primary(): Promise<RedisClientType> {
        if (!this._primaryClient) {
            this._primaryClient = this.buildClient(this._primary, 'primary', () => this.disconnectPrimary()).then(client => {
                if (client) {
                    return client;
                }
                return Promise.reject(new Error(`Imposible conectar con REDIS (primary)`));
            }).catch(err => {
                warning(`Error al conectar a REDIS. Reseteando cliente`, err);
                this._primaryClient = undefined;
                throw err;
            });
        }
        return this._primaryClient;
    }

    public get read(): Promise<RedisClientType> {
        if (!this._readClient) {
            if (this._read) {
                this._readClient = this.buildClient(this._read, 'read', () => this.disconnectRead()).then(client => {
                    if (client) {
                        return client;
                    }
                    return Promise.reject(new Error(`Imposible conectar con REDIS (read)`));
                }).catch(err => {
                    warning(`Error al conectar a REDIS. Reseteando cliente`, err);
                    this._readClient = undefined;
                    throw err;
                });
            } else {
                this._readClient = this.primary;
            }
        }
        return this._readClient;
    }

    private async buildClient(config: IRedis, type: 'primary'|'read', onError: (err?: any) => void): Promise<RedisClientType|null> {
        const client: RedisClientType = createClient({
            url: `redis://${config.host}:${config.port}`,
            socket: {
                reconnectStrategy: (retries) => {
                    if (retries > RedisCluster.MAX_RECONNECT_TRIES) {
                        error(`Imposible conectar con REDIS (${type})`);
                        return new Error(`Imposible conectar con REDIS (${type})`);
                    }
                    const delay = Math.min(retries * 100, 1000);
                    warning(`Reintentando conectar con redis (${type})...${retries}/${RedisCluster.MAX_RECONNECT_TRIES}`);
                    return delay;
                },

            }
        });

        client.on('error', (err: any) => {
            error(`Redis Client Error. Reset client. (${type})`, err);
            onError(err);
        });

        try {
            await client.connect().then(() => {
                info(`Conectado a REDIS (${type})`);
            });
            return client;
        } catch (e) {
            error(`Error al conectar a REDIS (${type})`);
            await client.quit();
            return null;
        }
    }
}
