/**
 * Editor: Juan C. Martínez
 * Fecha: Mon, 29 Jun 2026 12:58:11 GMT
 * Hash: d6c220faf092a044f90e696d2b03c871
 * Versión: 2026.6.29+1-juancmartinez
 * Anterior: 2026.6.17+3-josantoniojimnez
 * Proyecto: git@github.com:alpred/meteored-svc-data-alertas.git
 */

import process from "node:process";

import type {IPodInfo} from "@mr/core-workload/config/pod";

import {error, info, warning} from "../../utiles/log";
import {createClient, type RedisClientType} from "redis";
import {readJSON} from "../../utiles/fs";
import {md5} from "../../utiles/hash";
import {random} from "../../utiles/random";

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
    clientTimeout?: number;
}

type IRedis = IRedisHost;

type IRedisCluster = {
    primary: IRedis|IRedis[];
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

/**
 * Cliente Redis con namespace por servicio y utilidades de acceso comunes.
 *
 * Gestiona internamente una conexión al clúster (lectura/escritura) y ofrece
 * operaciones de lectura, escritura, serialización JSON y locks distribuidos.
 */
export class Redis implements AsyncDisposable {
    /* STATIC */

    /**
     * Construye un `Error` enriquecido con contexto de operación y causa original.
     *
     * @param message Mensaje contextual de la operación que ha fallado.
     * @param err Error capturado durante la operación asíncrona.
     * @returns Instancia de `Error` con detalle contextual y de causa.
     */
    private static buildPromiseError(message: string, err: unknown): Error {
        const errorMessage = err instanceof Error ? err.message : String(err);
        return new Error(`${message}. Causa: ${errorMessage}`);
    }

    /**
     * Crea una instancia de cliente Redis.
     *
     * @param config Parámetros de creación del cliente.
     */
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

    /**
     * Libera el clúster Redis asociado a la instancia.
     */
    public async [Symbol.asyncDispose](): Promise<void> {
        if (this._cluster) {
            const cluster = await this._cluster;
            await cluster[Symbol.asyncDispose]();
            info(`Desconectado de REDIS (cluster)`);
        }
    }

    private get cluster(): Promise<RedisCluster> {
        if (!this._cluster) {
            this._cluster = readJSON<IRedis|IRedisCluster>(this.credenciales).then(data => {
                let primaries: IRedis[];
                let read: IRedis|undefined;

                if ("primary" in data) {
                    if (Array.isArray(data.primary)) {
                        primaries = data.primary;
                    } else {
                        primaries = [data.primary];
                    }

                    if ("read" in data) {
                        read = data.read;
                    } else {
                        read = undefined;
                    }
                } else {
                    primaries = [data];
                }

                return new RedisCluster(primaries, read, this.options);
            });
        }
        return this._cluster;
    }

    /**
     * Obtiene uno o varios valores desde Redis.
     *
     * @param key Clave única o lista de claves.
     * @param options Opciones de consulta.
     * @returns Buffer, lista de buffers o `null` si no existe valor o hay error.
     */
    public async get(key: string|string[], {shared}: QueryOptions = {}): Promise<Buffer|Buffer[]|null> {
        try {
            const cluster = await this.cluster;
            const client = await cluster.read.catch(err => {
                throw Redis.buildPromiseError("Error obteniendo cliente para get", err);
            });

            if (Array.isArray(key)) {
                const theKeys = key.map(k => this.buildKey(k, shared||false));

                const multi = client.multi();
                theKeys.forEach(k => multi.get(k));

                const data = await multi.exec().catch(err => {
                    throw Redis.buildPromiseError("Error obteniendo datos para get (multi)", err);
                });
                return data.map(item => !!item ? Buffer.from(item as unknown as string, 'utf-8') : null) as Buffer[];
            } else {
                const theKey = this.buildKey(key, shared||false);
                const data: string|null = await client.get(theKey).catch(err => {
                    throw Redis.buildPromiseError("Error obteniendo datos para get (single)", err);
                }) as string|null;
                if (data) {
                    return Buffer.from(data, 'utf-8');
                }
            }
        } catch (e) {
            warning(`Error obteniendo ${key} de REDIS`, e);
        }
        return null;
    }

    /**
     * Guarda un valor en Redis.
     *
     * @param key Clave a persistir.
     * @param data Valor en formato `Buffer`.
     * @param options Opciones de guardado.
     */
    public async set(key: string, data: Buffer, {shared, ttl}: SaveOptions = {}): Promise<void> {
        try {
            const cluster = await this.cluster;

            const primaryClients = await Promise.all(cluster.primaries).catch(err => {
                throw Redis.buildPromiseError("Error obteniendo cliente para set", err);
            });

            const theKey = this.buildKey(key, shared||false);

            await Promise.all(primaryClients.map(async client => {
                const multi = client.multi()
                    .set(theKey, data.toString('utf-8'))
                ;

                if (ttl !== undefined && ttl>=0) {
                    multi.expire(theKey, ttl);
                }

                await multi.exec();
            }));
        } catch (e) {
            warning(`Error guardando ${key} en REDIS`, e);
        }
    }

    /**
     * Carga y deserializa JSON desde Redis.
     *
     * @param key Clave única o lista de claves.
     * @param options Opciones de consulta.
     * @returns Entidad tipada, lista tipada o `null`.
     */
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

    /**
     * Serializa y guarda JSON en Redis.
     *
     * @param key Clave a persistir.
     * @param data Estructura serializable a JSON.
     * @param options Opciones de guardado.
     */
    public async saveJSON(key: string, data: any, {shared, ttl}: SaveOptions = {}): Promise<void> {
        await this.set(key, Buffer.from(JSON.stringify(data), 'utf-8'), {shared, ttl});
    }

    /**
     * Inserta múltiples registros en una única transacción Redis.
     *
     * @param items Conjunto de inserciones con su TTL.
     */
    public async bulkSet(items: IInsert[]): Promise<void> {
        const cluster = await this.cluster;

        // const client = await cluster.primary;
        const primaryClients = await Promise.all(cluster.primaries);

        await Promise.all(primaryClients.map(async client => {
            const multi = client.multi();

            for (const item of items) {
                const theKey = this.buildKey(item.key, item.sharedKey??false);
                multi.set(theKey, item.value);

                if (item.ttl !== undefined && item.ttl>=0) {
                    multi.expire(theKey, item.ttl);
                }
            }

            await multi.exec();
        }));
    }

    /**
     * Busca claves por patrón.
     *
     * @param pattern Patrón Redis (p. ej. `prefijo:*`).
     * @param options Opciones de consulta.
     * @returns Lista de claves que cumplen el patrón.
     */
    public async searchKeys(pattern: string, {shared}: QueryOptions = {}): Promise<string[]> {
        try {
            const cluster = await this.cluster;

            const client = await cluster.read.catch((err: unknown) => {
                throw Redis.buildPromiseError("Error obteniendo cliente para searchKeys", err);
            });

            return await client.keys(this.buildKey(pattern, shared??false));
        } catch (e) {
            warning(`Error buscando keys con patrón ${pattern} en REDIS`, e);
        }
        return [];
    }

    /**
     * Intenta adquirir un lock distribuido para un conjunto de claves.
     *
     * @param keys Claves que participan en el lock.
     * @param options Opciones del lock (namespace compartido y TTL).
     * @returns Identificador de lock, cadena vacía si ya está bloqueado, o `null` en error.
     */
    public async aquireLock(keys: string[], {shared, ttl}: SaveOptions = {}): Promise<string|null> {
        if (keys.length === 0) {
            return null;
        }

        try {
            const cluster = await this.cluster;

            const primaryClients = await Promise.all(cluster.primaries).catch((err: unknown) => {
                throw Redis.buildPromiseError("Error obteniendo cliente para aquireLock", err);
            });

            const theKeys = keys.map(k => this.buildKey(k, shared ?? false));

            const lockID = md5(`${Date.now()}-${random(8)}`);

            const scriptLUA = `
                local ttl = tonumber(ARGV[2])
                for i, key in ipairs(KEYS) do
                    if redis.call("exists", key) == 1 then
                        return 0
                    end
                end
                for i, key in ipairs(KEYS) do
                    if ttl and ttl > 0 then
                        redis.call("set", key, ARGV[1], "PX", tostring(ttl))
                    else
                        redis.call("set", key, ARGV[1])
                    end
                end
                return 1
            `;

            const results = await Promise.all(primaryClients.map(async client => {
                return await client.eval(scriptLUA, {
                    keys: theKeys,
                    arguments: [
                        lockID,
                        ttl !== undefined && ttl>=0 ? `${ttl * 1000}` : '-1',
                    ],
                });
            }));

            return results.every(result => result === 1) ? lockID : '';
        } catch (e) {
            warning(`Error adquiriendo lock para keys ${keys.join(', ')} en REDIS`, e);
        }
        return null;
    }

    /**
     * Libera un lock distribuido solo si coincide el `lockId` esperado.
     *
     * @param keys Claves bloqueadas.
     * @param lockId Identificador devuelto en la adquisición del lock.
     * @param options Opciones de consulta.
     */
    public async releaseLock(keys: string[], lockId: string, {shared}: QueryOptions = {}): Promise<void> {
        if (keys.length === 0) {
            return;
        }

        try {
            const cluster = await this.cluster;

            const primaryClients = await Promise.all(cluster.primaries).catch((err: unknown) => {
                throw Redis.buildPromiseError("Error obteniendo cliente para releaseLock", err);
            });

            const theKeys = keys.map(k => this.buildKey(k, shared ?? false));

            const scriptLUA = `
                local released = 0
                for i, key in ipairs(KEYS) do
                    if redis.call("get", key) == ARGV[1] then
                        redis.call("del", key)
                        released = released + 1
                    end
                end
                return released
            `;

            await Promise.all(primaryClients.map(async client => {
                return await client.eval(scriptLUA, {
                    keys: theKeys,
                    arguments: [
                        lockId,
                    ],
                });
            }));
        } catch (e) {
            warning(`Error liberando lock para keys ${keys.join(', ')} en REDIS`, e);
        }

    }

    private buildKey(key: string, shared: boolean) {
        if (shared) {
            return key;
        }
        const namespace = (process.env['K8S_NAMESPACE']??'default').replace('meteored','mr');
        return `${namespace}:${this.config.servicio}:${key}`;
    }
}


class RedisCluster implements AsyncDisposable {
    /* STATIC */
    private static readonly MAX_REDIS_GET_CLIENT_MS: number = 50;
    private static readonly MAX_REDIS_GET_MS: number = 10;
    private static readonly MAX_RECONNECT_TRIES: number = 3;

    /* INSTANCE */
    private _primaryClients?: (Promise<RedisClientType>[])|null;
    private _readClient?: Promise<RedisClientType>|null;
    public constructor(private readonly _primaries: IRedis[], private readonly _read?: IRedis, private readonly options: IRedisOptions = {}) {
    }

    public async [Symbol.asyncDispose](): Promise<void> {
        // Si el cliente de lectura es distinto del primero de los primarios, lo desconectamos también
        const distinctReadInstance = this._readClient && this._readClient !== this._primaryClients?.[0];

        if (this._primaryClients) {
            while (this._primaryClients.length > 0) {
                const clientPromise = this._primaryClients.pop();
                if (clientPromise) {
                    const client = await clientPromise;
                    await client.quit();
                }
            }
            info(`Desconectado de REDIS (primary)`);
        }
        if (distinctReadInstance) {
            const client = await this._readClient;
            await client?.quit();
            info(`Desconectado de REDIS (read)`);
        } else {
            await this.disconnectRead();
        }
    }

    private async disconnectPrimaries(): Promise<void> {
        if (this._primaryClients) {
            // Si el cliente de lectura es el mismo que el primero de los primarios, no lo desconectamos aquí
            const includeRead = this._readClient && this._readClient === this._primaryClients[0];

            while (this._primaryClients.length > 0) {
                const clientPromise = this._primaryClients.pop();
                if (clientPromise) {
                    const client = await clientPromise;
                    await client.quit();
                }
            }
            info(`Desconectado de REDIS (primary)`);
            this._primaryClients = undefined;

            // Si el cliente de lectura es el mismo que el primero de escritura, lo marcamos como desconectado también
            if (includeRead) {
                info(`Desconectado de REDIS (read)`);
                this._readClient = undefined;
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

    public get primaries(): Promise<RedisClientType>[] {
        if (!this._primaryClients) {
            this._primaryClients = this._primaries.map(primary => {
                return this.buildClient(primary, 'primary', () => this.disconnectPrimaries()).then(client => {
                    if (client) {
                        return client;
                    }
                    return Promise.reject(new Error(`Imposible conectar con REDIS (primary)`));
                }).catch(err => {
                    warning(`Error al conectar a REDIS. Reseteando cliente`, err);
                    this._primaryClients = undefined;
                    throw err;
                });
            });
        }
        return this._primaryClients;
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
                this._readClient = this.primaries[0];
            }
        }
        return this._readClient;
    }

    private async buildClient(config: IRedis, type: 'primary'|'read', onError: (err?: any) => void): Promise<RedisClientType|null> {
        const client: RedisClientType = createClient({
            url: `redis://${config.host}:${config.port}`,
            socket: {
                connectTimeout: this.options.clientTimeout||RedisCluster.MAX_REDIS_GET_CLIENT_MS,
                reconnectStrategy: (retries) => {
                    if (retries > RedisCluster.MAX_RECONNECT_TRIES) {
                        error(`Imposible conectar con REDIS (${type})`);
                        return new Error(`Imposible conectar con REDIS (${type})`);
                    }
                    const delay = Math.min(retries * 100, 1000);
                    warning(`Reintentando conectar con redis (${type})...${retries}/${RedisCluster.MAX_RECONNECT_TRIES}`);
                    return delay;
                },
            },
            commandOptions: {
                timeout: this.options.timeout||RedisCluster.MAX_REDIS_GET_MS,
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
