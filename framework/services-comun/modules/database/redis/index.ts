/**
 * Editor: David Martínez Moya
 * Fecha: Thu, 13 Aug 2026 09:14:19 GMT
 * Hash: cfb8d8f8027650aafe64b44eeabe112a
 * Versión: 2026.8.13+2-davidmartinezmoya
 * Anterior: 2026.7.30+1-juancmartinez
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

type IHInsert = {
    key: string;
    field: string;
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
     * Lee un campo concreto de un hash contra el nodo de lectura. El valor almacenado es un
     * envoltorio JSON `{expires, data}` escrito por `hSet`/`bulkHSet`, por lo que aquí se
     * evalúa manualmente la caducidad (Redis < 7.4 no soporta `hExpire`): si el campo está
     * caducado se trata como inexistente. La clave se usa tal cual, sin prefijo de namespace.
     * Los errores no se propagan: se registran como aviso y se devuelve `null`.
     *
     * @param key Clave del hash.
     * @param field Campo a recuperar.
     * @returns Objeto `{[field]: valor}` con el contenido crudo, o `null` si no existe, está caducado o falla.
     */
    public async hGet(key: string, field: string): Promise<{[field: string]: string}|null> {
        try {
            const cluster = await this.cluster;
            const client = await cluster.read.catch(err => {
                throw Redis.buildPromiseError("Error obteniendo cliente para hGet", err);
            });

            const response = await client.hGet(key, field).then(d => d ? JSON.parse(d) : null).catch(err => {
                throw Redis.buildPromiseError("Error obteniendo datos para hGet (single)", err);
            });
            if (response && (!response.expires || response.expires > 0 && response.expires < Date.now())) { // TODO: Cambiar uso de la expiración cuando se actualice a la 7.4 de Redis (hExpire)
                return {[field]: response.data} as unknown as { [field: string]: string };
            }
        } catch (e) {
            warning(`Error obteniendo ${key} de REDIS`, e);
        }
        return null;
    }

    /**
     * Recupera de una sola vez todos los campos de un hash contra el nodo de lectura,
     * descartando los que estén caducados según el envoltorio `{expires, data}` (control
     * manual de TTL por campo mientras no se disponga de `hExpire`). Devuelve los valores
     * crudos sin deserializar; usa `loadHJSON` si esperas JSON. Los errores se registran
     * como aviso y se devuelve `null`.
     *
     * @param key Clave del hash.
     * @returns Mapa `campo → valor` con los campos vigentes (posiblemente vacío), o `null` si falla.
     */
    public async hGetAll(key: string): Promise<{[field: string]: string}|null> {
        try {
            const cluster = await this.cluster;
            const client = await cluster.read.catch(err => {
                throw Redis.buildPromiseError("Error obteniendo cliente para get", err);
            });

            const response = await client.hGetAll(key).catch(err => {
                throw Redis.buildPromiseError("Error obteniendo datos para hGetAll (single)", err);
            });

            const fields = Object.keys(response)
                .filter(field => {
                    const value = JSON.parse(response[field]);
                    return !value.expires || value.expires > 0 && value.expires < Date.now(); // TODO: Cambiar uso de la expiración cuando se actualice a la 7.4 de Redis (hExpire)
                });

            return {
                ...fields.reduce((acc, field) => {
                    const value = JSON.parse(response[field]);
                    acc[field] = value.data;
                    return acc;
                }, {} as {[field: string]: string})
            } as {[field: string]: string}|null;
        } catch (e) {
            warning(`Error obteniendo ${key} de REDIS`, e);
        }
        return null;
    }

    /**
     * Escribe una clave simple en **todos** los nodos primarios en paralelo, cada uno dentro
     * de un `MULTI` que combina el `SET` y, si procede, el `EXPIRE`. La clave se prefija con
     * `namespace:servicio:` salvo que se marque como compartida. Un `ttl` negativo o ausente
     * deja la clave sin caducidad. La operación nunca lanza: los fallos se registran como
     * aviso, por lo que conviene tratarla como escritura best-effort.
     *
     * @param key Clave lógica a persistir (sin prefijo).
     * @param data Contenido a almacenar; se guarda como cadena UTF-8.
     * @param options `shared` para omitir el namespace y `ttl` (segundos) para la caducidad.
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
     * Escribe un campo de hash en todos los nodos primarios. Como Redis < 7.4 no permite
     * caducidad por campo, el valor se envuelve en `{expires, data}` y la expiración se
     * verifica en lectura (`hGet`/`hGetAll`); es decir, el campo no se elimina solo del
     * servidor. La clave se prefija con `namespace:servicio:` salvo que sea compartida.
     * Los errores se registran como aviso y no se propagan.
     *
     * @param key Clave lógica del hash (sin prefijo).
     * @param data Contenido del campo; se guarda como cadena UTF-8 dentro del envoltorio.
     * @param field Campo del hash a escribir.
     * @param options `shared` para omitir el namespace y `ttl` (segundos) usado como marca de caducidad.
     */
    public async hSet(key: string, field: string, data: Buffer, {shared, ttl}: SaveOptions = {}): Promise<void> {
        try {
            const cluster = await this.cluster;

            const primaryClients = await Promise.all(cluster.primaries).catch(err => {
                throw Redis.buildPromiseError("Error obteniendo cliente para set", err);
            });

            const theKey = this.buildKey(key, shared||false);

            await Promise.all(primaryClients.map(async client => {
                const multi = client.multi()
                    .hSet(theKey, field, JSON.stringify({
                        expires: ttl ? Date.now() + ttl * 1000 : undefined, // TODO: Cambiar uso de la expiración cuando se actualice a la 7.4 de Redis (hExpire)
                        data: data.toString('utf-8')
                    }));

                await multi.exec();
            }));
        } catch (e) {
            warning(`Error guardando ${key} en REDIS`, e);
        }
    }

    /**
     * Añade o actualiza un miembro de un sorted set en todos los nodos primarios. Si el
     * miembro ya existe, `ZADD` sustituye su puntuación, lo que permite usarlo como registro
     * de "último valor" (por ejemplo, marcas de tiempo consultables luego con
     * `searchMaxScore`). No admite TTL: `SaveOptions.ttl` se ignora aquí. Los errores se
     * registran como aviso y no se propagan.
     *
     * @param key Clave lógica del sorted set (sin prefijo).
     * @param member Miembro a insertar o actualizar.
     * @param score Puntuación asociada al miembro; determina el orden.
     * @param options `shared` para omitir el prefijo de namespace.
     */
    public async zAdd(key: string, member: string, score: number, {shared}: SaveOptions = {}): Promise<void> {
        try {
            const cluster = await this.cluster;

            const primaryClients = await Promise.all(cluster.primaries).catch(err => {
                throw Redis.buildPromiseError("Error obteniendo cliente para set", err);
            });

            const theKey = this.buildKey(key, shared||false);
            await Promise.all(primaryClients.map(async client => {
                await client.zAdd(theKey, {
                    score,
                    value: member
                });
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
     * Carga y deserializa JSON en un Hash desde Redis.
     *
     * @param key Clave única.
     * @param field Campo del hash a persistir.
     * @returns Entidad tipada, lista tipada o `null`.
     */
    public async loadHJSON<T=any>(key: string, field?: string): Promise<{ [p: string]: T }|null> {
        const data = field ? await this.hGet(key as string, field) : await this.hGetAll(key);

        if (data) {
            const result: { [field: string]: T } = {};
            if (field) {
                result[field] = JSON.parse(data[field]) as T;
            } else {
                for (const field in data) {
                    result[field] = JSON.parse(data[field]) as T;
                }
            }
            return result;
        }
        return null;
    }

    /**
     * Atajo de `set` que serializa la estructura con `JSON.stringify` antes de escribirla.
     * Contrapartida de `loadJSON`; comparte su misma convención de claves y su naturaleza
     * best-effort (los errores se registran, no se lanzan).
     *
     * @param key Clave lógica a persistir (sin prefijo).
     * @param data Estructura serializable a JSON.
     * @param options `shared` para omitir el namespace y `ttl` (segundos) para la caducidad.
     */
    public async saveJSON(key: string, data: any, {shared, ttl}: SaveOptions = {}): Promise<void> {
        await this.set(key, Buffer.from(JSON.stringify(data), 'utf-8'), {shared, ttl});
    }

    /**
     * Atajo de `hSet` que serializa la estructura a JSON y la guarda como campo de un hash.
     * Contrapartida de `loadHJSON`. Recuerda que el `ttl` es una caducidad lógica evaluada
     * en lectura, no un vencimiento real en el servidor.
     *
     * @param key Clave lógica del hash (sin prefijo).
     * @param field Campo del hash a escribir.
     * @param data Estructura serializable a JSON.
     * @param options `shared` para omitir el namespace y `ttl` (segundos) como marca de caducidad.
     */
    public async saveHJSON(key: string, field: string, data: any, {shared, ttl}: SaveOptions = {}): Promise<void> {
        await this.hSet(key, field, Buffer.from(JSON.stringify(data), 'utf-8'), {shared, ttl});
    }

    /**
     * Atajo de `zAdd` para registrar un miembro puntuado en un sorted set. Pese al nombre no
     * serializa nada a JSON: `member` y `score` se envían tal cual, ya que un sorted set
     * almacena pares miembro/puntuación. No admite TTL.
     *
     * @param key Clave lógica del sorted set (sin prefijo).
     * @param member Miembro a insertar o actualizar.
     * @param score Puntuación asociada al miembro.
     * @param options `shared` para omitir el prefijo de namespace.
     */
    public async saveZJSON(key: string, member: string, score: number, {shared}: SaveOptions = {}): Promise<void> {
        await this.zAdd(key, member, score, {shared});
    }

    /**
     * Escribe un lote de claves simples agrupando todos los comandos en un único `MULTI` por
     * nodo primario, lo que reduce drásticamente los viajes de red frente a llamar a `set` en
     * bucle. Cada elemento decide su propio prefijo (`sharedKey`) y su propio TTL; un `ttl`
     * negativo deja la clave sin caducidad. A diferencia de `set`, **sí propaga los errores**,
     * así que la llamada debe capturarlos.
     *
     * @param items Conjunto de inserciones, cada una con clave, valor, TTL y ámbito de clave.
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
     * Equivalente a `bulkSet` para campos de hash: agrupa todos los `HSET` en un `MULTI` por
     * nodo primario y envuelve cada valor en `{expires, data}` para la caducidad lógica
     * evaluada en lectura. Sale de inmediato si la lista está vacía y **propaga los errores**
     * al llamante.
     *
     * @param items Conjunto de inserciones, cada una con clave, campo, valor, TTL y ámbito de clave.
     */
    public async bulkHSet(items: IHInsert[]): Promise<void> {
        if (items.length === 0) return;

        const cluster = await this.cluster;

        // const client = await cluster.primary;
        const primaryClients = await Promise.all(cluster.primaries);

        await Promise.all(primaryClients.map(async client => {
            const multi = client.multi();

            for (const item of items) {
                const theKey = this.buildKey(item.key, item.sharedKey??false);
                multi.hSet(theKey, item.field, JSON.stringify({
                    expires: item.ttl ? Date.now() + item.ttl * 1000 : undefined, // TODO: Cambiar uso de la expiración cuando se actualice a la 7.4 de Redis (hExpire)
                    data: item.value
                }));
            }

            await multi.exec();
        }));
    }

    /**
     * Recorre el espacio de claves con `SCAN` iterativo (lotes de 1000, tipo `string`) contra
     * el nodo de lectura, evitando el bloqueo que provocaría `KEYS`. El patrón se prefija
     * **siempre** con el namespace del servicio: `shared` se acepta por simetría pero se
     * ignora; usa `searchField` si necesitas buscar en claves compartidas. Devuelve las claves
     * completas, ya prefijadas.
     *
     * @param pattern Patrón de glob Redis relativo al servicio (p. ej. `prefijo:*`).
     * @param options Opciones de consulta; `shared` no tiene efecto en este método.
     * @returns Lista de claves coincidentes, o vacía si no hay resultados o se produce un error.
     */
    public async searchKeys(pattern: string, {shared}: QueryOptions = {}): Promise<string[]> {
        try {
            const cluster = await this.cluster;

            const client = await cluster.read.catch((err: unknown) => {
                throw Redis.buildPromiseError("Error obteniendo cliente para searchKeys", err);
            });

            const keys: string[] = [];
            for await (const keysBatch of client.scanIterator({
                TYPE: "string",
                MATCH: this.buildKey(pattern, false),
                COUNT: 1000,
            })) {
                if (keysBatch.length) {
                    keys.push(...keysBatch);
                }
            }

            return keys;
        } catch (e) {
            warning(`Error buscando keys con patrón ${pattern} en REDIS`, e);
        }
        return [];
    }

    /**
     * Devuelve la puntuación más alta de un sorted set consultando el nodo de lectura con
     * `ZRANGE ... REV BY SCORE LIMIT 0 1`, es decir, recuperando un único elemento en lugar de
     * traer el conjunto entero. Útil para conocer la última marca registrada con
     * `zAdd`/`saveZJSON`. Pese al nombre, `pattern` es una clave concreta (se prefija según
     * `shared`), no un patrón de búsqueda.
     *
     * @param pattern Clave del sorted set a inspeccionar.
     * @param options `shared` para omitir el prefijo de namespace.
     * @returns Puntuación máxima, o `null` si el conjunto está vacío o se produce un error.
     */
    public async searchMaxScore(pattern: string, {shared}: QueryOptions = {}): Promise<number|null> {
        try {
            const cluster = await this.cluster;

            const client = await cluster.read.catch((err: unknown) => {
                throw Redis.buildPromiseError("Error obteniendo cliente para searchMaxScore", err);
            });

            const thePattern = this.buildKey(pattern, shared??false);
            return await client.zRangeWithScores(thePattern, '+inf', '-inf', {
                REV: true,
                BY: 'SCORE',
                LIMIT: {offset: 0, count: 1}
            }).then(results => {
                if (results.length > 0) {
                    return results[0].score as number;
                }
                return null;
            });
        } catch (e) {
            warning(`Error buscando max score con patrón ${pattern} en REDIS`, e);
        }

        return null;
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

    /**
     * Calcula la clave física a partir de la lógica. Por defecto aísla cada servicio y
     * entorno anteponiendo `<namespace>:<servicio>:`, donde el namespace sale de la variable
     * `K8S_NAMESPACE` (`default` si no está definida) y se abrevia `meteored` como `mr`. Con
     * `shared` la clave se devuelve intacta, lo que permite compartir datos entre servicios.
     *
     * @param key Clave lógica indicada por el llamante.
     * @param shared Si es `true`, no se aplica ningún prefijo.
     * @returns Clave final tal y como se envía a Redis.
     */
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
            pingInterval: 10000, // PING automático para mantener vivo el canal en GCP (10 segundos)
            socket: {
                keepAlive: true, // Mantener vivo el socket
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
