import {createClient, createCluster, type RedisClientType, type RedisClusterType} from "redis";
import {error, info, warning} from "services-comun/modules/utiles/log";
import {exists, readJSON} from "services-comun/modules/utiles/fs";
import {DefaultValkey} from "./defaultValkey";

type RedisAnyClient = RedisClientType | RedisClusterType;

interface IRedisCredenciales {
    host: string;
    port: string;
}

interface IRedisCredencialesCluster {
    primary: IRedisCredenciales;
    read?: IRedisCredenciales;
}

/**
 * MemoryStore basado en Valkey/Redis.
 *
 * Configuración recomendada en Valkey:
 *   maxmemory 1gb
 *   maxmemory-policy allkeys-lru
 *
 * Con `allkeys-lru`, cuando se alcance el límite de 1GB,
 * Valkey eliminará automáticamente las claves menos usadas recientemente (LRU),
 * garantizando que siempre haya espacio para nuevas entradas.
 */
export class Valkey {
    /* STATIC */
    private static instance: Valkey | DefaultValkey | undefined = undefined;
    private static instanceOk: boolean = false;
    private static readonly MAX_RECONNECT_TRIES: number = 3;

    public static async getInstance(): Promise<Valkey | DefaultValkey> {
        if (!this.instanceOk) {
            if (await exists('files/credenciales/redis.json')) {
                const credenciales = await readJSON<IRedisCredenciales | IRedisCredencialesCluster>('files/credenciales/redis.json');
                const primary = "primary" in credenciales ? credenciales.primary : credenciales;
                const client = await Valkey.buildClient(primary);
                if (client) {
                    this.instance = new Valkey(client);
                }
            }

            this.instanceOk = true;
        }

        if (!this.instance) {
            info("DefaultValkey: Valkey no disponible, usando DefaultValkey (sin cache)");
            this.instance = new DefaultValkey();
        }

        return this.instance;
    }

    private static async buildClient(config: IRedisCredenciales): Promise<RedisAnyClient | null> {
        // Primero intentamos como cluster (maneja MOVED nativamente)
        try {
            return await Valkey.buildClusterClient(config);
        } catch (e) {
            warning("Valkey: No se pudo conectar como cluster, intentando standalone...");
        }

        // Si falla cluster, intentamos standalone
        try {
            return await Valkey.buildStandaloneClient(config);
        } catch (e) {
            error("Valkey: Error conectando como standalone", e);
            return null;
        }
    }

    private static async buildStandaloneClient(config: IRedisCredenciales): Promise<RedisClientType | null> {
        try {
            const client: RedisClientType = createClient({
                url: `redis://${config.host}:${config.port}`,
                socket: {
                    reconnectStrategy: (retries: number) => {
                        if (retries > Valkey.MAX_RECONNECT_TRIES) {
                            return new Error("Imposible conectar con Valkey");
                        }
                        return Math.min(retries * 100, 1000);
                    },
                },
            });

            client.on('error', (err: any) => {
                error("Valkey Standalone Error");
            });

            await client.connect();
            info("Valkey: Conectado en modo standalone");
            return client;
        } catch (e) {
            error("Valkey: Error conectando como standalone", e);
            return null;
        }
    }

    private static async buildClusterClient(config: IRedisCredenciales): Promise<RedisClusterType> {
        const client: RedisClusterType = createCluster({
            rootNodes: [{
                url: `redis://${config.host}:${config.port}`,
            }],
            defaults: {
                socket: {
                    reconnectStrategy: (retries: number) => {
                        if (retries > Valkey.MAX_RECONNECT_TRIES) {
                            return new Error("Imposible conectar con Valkey cluster");
                        }
                        return Math.min(retries * 100, 1000);
                    },
                },
            },
        });

        client.on('error', (err: any) => {
            error("Valkey Cluster Error");
        });

        await client.connect();
        info("Valkey: Conectado en modo cluster");
        return client;
    }

    /* INSTANCE */
    private constructor(
        private readonly client: RedisAnyClient,
    ) {
    }

    private buildCacheKey(namespace: string, ids?: (string | number)[]): string {
        const parts = [namespace, ...ids ?? []];
        return parts.join(':');
    }

    public async get<T>(namespace: string, ids: (string | number)[]): Promise<T | null> {
        const key = this.buildCacheKey(namespace, ids);
        try {
            const data = await this.client.get(key);
            if (data) {
                return JSON.parse(data as string) as T;
            }
        } catch (e) {
            warning(`Valkey: Error obteniendo cache ${key}`, e);
        }
        return null;
    }

    public async set<T>(namespace: string, ids: (string | number)[], data: T, ttl?: number): Promise<void> {
        const key = this.buildCacheKey(namespace, ids);
        try {
            const value = JSON.stringify(data);
            if (ttl !== undefined && ttl >= 0) {
                await this.client.set(key, value, {EX: ttl});
            } else {
                await this.client.set(key, value);
            }
            console.log(`Valkey: Cache guardada ${key} (TTL: ${ttl ?? 'indefinido'})`);
        } catch (e) {
            warning(`Valkey: Error guardando cache ${key}`, e);
        }
    }

    public async delete(namespace: string, ids: (string | number)[]): Promise<void> {
        try {

            const key = this.buildCacheKey(namespace, ids);

            await this.client.del(key);
            const deleted = await this.client.del(key);
            if (deleted > 0) {
                console.log(`Valkey: Cache eliminada ${key}`);
            } else {
                console.log(`Valkey: Cache [a eliminar] no encontrada ${key}`);
            }

        } catch (e) {
            warning(`Valkey: Error eliminando cache`, e);
        }
    }

    public async deletePattern(namespace?: string, ids?: (string | number)[]): Promise<void> {
        try {
            if (namespace) {
                const key = this.buildCacheKey(namespace, ids);
                const pattern = `${key}:*`;
                const keys = await this.client.keys(pattern);
                keys.push(key); // También eliminamos la clave exacta
                if (keys.length > 0) {
                    await Promise.all(keys.map(async (k: string) => {
                        await this.client.del(k).then(() => console.log(`Valkey: Cache eliminada ${k}`));
                    }));
                }
            } else {
                const pattern = `*`;
                const keys = await this.client.keys(pattern);
                if (keys.length > 0) {
                    await Promise.all(keys.map((k: string) => this.client.del(k)));
                }
                console.log(`Valkey: Cache vaciada completamente`);
            }
        } catch (e) {
            warning(`Valkey: Error eliminando cache`, e);
            return Promise.reject();
        }
    }
}

