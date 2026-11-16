/**
 * Editor: Chema
 * Fecha: Wed, 04 Nov 2026 07:49:02 GMT
 * Hash: b0c89df335f35ecf3270ef5d772b42e4
 * Versión: 2026.11.4+2-chema
 * Anterior: 2026.11.4+1-chema
 * Proyecto: https://github.com/alpred-cms/svc-redaccion.git
 */

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
    /** Claves que se piden a Valkey en cada vuelta de SCAN (orientativo): acota la memoria al borrar por patrón. */
    private static readonly SCAN_COUNT: number = 500;

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

    /**
     * Guarda un valor en la cache, serializado como JSON.
     *
     * @param namespace - Prefijo de la clave.
     * @param ids - Resto de partes de la clave; se unen con `:` tras el namespace.
     * @param data - Valor a guardar.
     * @param ttl - Caducidad en **segundos** (`EX`), no en milisegundos. Si se omite o es `<= 0`, la clave no caduca.
     */
    public async set<T>(namespace: string, ids: (string | number)[], data: T, ttl?: number): Promise<void> {
        const key = this.buildCacheKey(namespace, ids);
        try {
            const value = JSON.stringify(data);
            // EX 0 lo rechaza Valkey ("invalid expire time"), así que solo se envía con un TTL positivo
            if (ttl !== undefined && ttl > 0) {
                await this.client.set(key, value, {EX: ttl});
            } else {
                await this.client.set(key, value);
            }
            if (!PRODUCCION && !TEST) {
                info(`Valkey: Cache guardada ${key} (TTL: ${ttl ?? 'indefinido'})`);
            }
        } catch (e) {
            warning(`Valkey: Error guardando cache ${key}`, e);
        }
    }

    /**
     * Elimina una única clave de la cache.
     *
     * @param namespace - Prefijo de la clave.
     * @param ids - Resto de partes de la clave; se unen con `:` tras el namespace.
     */
    public async delete(namespace: string, ids: (string | number)[]): Promise<void> {
        try {
            const key = this.buildCacheKey(namespace, ids);
            // UNLINK quita la clave al momento y libera su memoria en segundo plano.
            // Devuelve cuántas claves borró (0 si no existía).
            const deleted = await this.client.unlink(key);
            if (deleted > 0) {
                info(`Valkey: Cache eliminada ${key}`);
            } else {
                info(`Valkey: Cache [a eliminar] no encontrada ${key}`);
            }

        } catch (e) {
            warning(`Valkey: Error eliminando cache`, e);
        }
    }

    /**
     * Elimina un grupo de claves de la cache, o la cache entera.
     *
     * - Con `namespace`: borra la clave exacta `namespace:ids` y todas las que cuelgan de ella (`namespace:ids:*`).
     * - Sin `namespace`: vacía la base de datos completa. En modo cluster solo hay una por instancia, así que
     *   se borra todo lo que contenga la instancia, sea o no de esta cache.
     *
     * Nunca se cargan todas las claves en memoria: el borrado por patrón va por lotes y el vaciado completo es un
     * único comando.
     *
     * @param namespace - Prefijo de las claves a borrar. Si se omite, se vacía toda la cache.
     * @param ids - Partes adicionales del prefijo; se unen con `:` tras el namespace.
     */
    public async deletePattern(namespace?: string, ids?: (string | number)[]): Promise<void> {
        try {
            if (namespace) {
                const key = this.buildCacheKey(namespace, ids);
                // La clave exacta no casa con el patrón `${key}:*`, así que se borra aparte.
                let total = await this.client.unlink(key);
                // SCAN recorre el keyspace por tramos sin bloquear Valkey (KEYS lo recorre entero de una vez y
                // devuelve todas las claves juntas). Cada llamada devuelve un lote de ~SCAN_COUNT claves y un cursor
                // para pedir el siguiente; el recorrido termina cuando el cursor vuelve a "0".
                // El cursor es un string opaco: un entero de 64 bits que no cabe en un number y, en cluster,
                // node-redis codifica además en qué shard va. Se devuelve tal cual en la siguiente llamada.
                // Borrar mientras se recorre es seguro: SCAN devuelve igualmente las claves que siguen existiendo.
                let cursor = "0";
                do {
                    const reply = await this.client.scan(cursor, {MATCH: `${key}:*`, COUNT: Valkey.SCAN_COUNT});
                    // toString() por si el cliente devuelve el cursor como Buffer
                    cursor = reply.cursor.toString();
                    if (reply.keys.length > 0) {
                        // Se borra el lote antes de pedir el siguiente, así que en memoria solo hay un lote cada vez.
                        // En cluster, node-redis reparte el UNLINK por shard, aunque las claves sean de slots distintos.
                        total += await this.client.unlink(reply.keys);
                    }
                } while (cursor !== "0");
                info(`Valkey: ${total} claves eliminadas para ${key}`);
            } else {
                // Un único comando en vez de recorrer las claves: la memoria en Node no depende de cuántas haya.
                // En cluster, node-redis envía FLUSHDB a todos los shards y solo da por buena la operación si todos
                // responden OK. ASYNC vacía la base de datos al momento y libera la memoria en un hilo de fondo,
                // sin bloquear el resto de peticiones.
                await this.client.flushDb("ASYNC");
                info(`Valkey: Cache vaciada completamente`);
            }
        } catch (e) {
            warning(`Valkey: Error eliminando cache`, e);
            return Promise.reject(e);
        }
    }
}

