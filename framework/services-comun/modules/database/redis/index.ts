/**
 * Editor: Juan C. Martínez
 * Fecha: Mon, 02 Nov 2026 11:05:48 GMT
 * Hash: 0a491a96f53308ffbc3b3f2504562c11
 * Versión: 2026.11.2+2-juancmartinez
 * Anterior: 2026.9.23+3-bixus
 * Proyecto: git@github.com:alpred/meteored-svc-cmp.git
 */

import {ClientOfflineError, type RedisClientType} from "redis";
import process from "node:process";

import type {IPodInfo} from "@mr/core-workload/config/pod";

import {error, info, warning} from "../../utiles/log";
import {errorType, LogThrottle} from "../../utiles/log-throttle";
import {readJSON} from "../../utiles/fs";
import {md5} from "../../utiles/hash";
import {random} from "../../utiles/random";
import {RedisCluster} from "./cluster";
import {RedisBatch, type IHIncrBy, type TBatchResult} from "./batch";

export type {IHIncrBy, TBatchResult} from "./batch";

interface IRedisBuild {
    pod: IPodInfo;
    credenciales?: string;
    options?: IRedisOptions;
}

type IRedisHost = {
    host: string
    port: string;
}

/**
 * Opciones del cliente Redis. Todas son opcionales. Sin ellas, el cliente reconecta solo, con espera exponencial hasta 5 s y sin rendirse nunca (antes se
 * rendía a los 3 reintentos y recreaba el cliente ante un error); sin conexión no hay cola offline y las operaciones fallan al instante, y los avisos y
 * errores de cliente salen como mucho una vez por tipo y minuto. Lo demás —`timeout` de 10 ms, `clientTimeout` de 50 ms, carga y conexión perezosas,
 * credenciales en `files/credenciales/redis.json`— es como antes.
 *
 * @property timeout             - Timeout (ms) de los comandos. Por defecto 10. Ojo: en node-redis 6.3.0 solo acota la espera previa al envío, no la
 *                                 respuesta (un comando ya enviado a un Redis lento espera igualmente).
 * @property clientTimeout       - Timeout (ms) de cada intento de conexión. Por defecto 50. Las operaciones sobre un nodo que aún no ha conectado
 *                                 nunca (arranque) esperan a que conecte durante `4 × clientTimeout + 700 ms` desde que se creó el cliente; después, sin conexión, fallan al instante.
 * @property maxReconnectDelayMs - Tope (ms) de la espera entre reconexiones (exponencial desde 100 ms, sin rendirse nunca). Por defecto 5 000.
 * @property logThrottleMs       - Un solo log por tipo de error y por este intervalo (ms), tanto los errores de cliente como los avisos de los métodos
 *                                 con Redis caído; 0 lo desactiva. Por defecto 60 000.
 * @property singleNode          - Índice, en la lista de primarios de las credenciales, del nodo que usan las operaciones de un solo nodo
 *                                 (`bulkHIncrBy`, `bulkHGetAll` y `expire` con `target: "single"`). Por defecto 0. Un índice fuera de rango
 *                                 es un error al crear el cliente (las operaciones fallan), no se usa el nodo 0 en silencio.
 * @property connectOnBuild      - Con `true`, las credenciales se cargan y se abren las conexiones al construir el cliente, en vez de en la
 *                                 primera operación. Por defecto `false`.
 */
export type IRedisOptions = {
    timeout?: number;
    clientTimeout?: number;
    maxReconnectDelayMs?: number;
    logThrottleMs?: number;
    singleNode?: number;
    connectOnBuild?: boolean;
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

/**
 * Opciones de `bulkHIncrBy`.
 *
 * @property shared    - Si es `true`, no se aplica el prefijo de namespace a las claves.
 * @property timeoutMs - Tiempo máximo (ms) que se espera al `EXEC`. Por defecto `options.timeout || 10`.
 */
export interface IBulkHIncrByOptions {
    shared?: boolean;
    timeoutMs?: number;
}

/**
 * Opciones de `bulkHGetAll`.
 *
 * @property shared - Si es `true`, no se aplica el prefijo de namespace a las claves.
 * @property node   - Nodo del que se lee: el nodo único (`"single"`, por defecto) o el de lectura (`"read"`).
 */
export interface IBulkHGetAllOptions {
    shared?: boolean;
    node?: "single" | "read";
}

/**
 * Opciones de `expire`.
 *
 * @property shared - Si es `true`, no se aplica el prefijo de namespace a la clave.
 * @property target - Nodos en los que se aplica: todos los primarios (`"all"`, por defecto) o solo el nodo único (`"single"`).
 */
export interface IExpireOptions {
    shared?: boolean;
    target?: "all" | "single";
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
 *
 * Conexión: un cliente por primario y otro para `read` si es un nodo distinto. Se abren en la primera operación o, con `connectOnBuild`, al construir. Cada
 * cliente reconecta solo y sin rendirse; sin conexión no hay cola offline y las operaciones fallan al instante (ver `IRedisOptions`).
 *
 * Límites de tiempo: **con Redis conectado pero sin responder, `get`, `set`, `aquireLock`, los `MULTI` y el resto de métodos no tienen límite de tiempo**.
 * En node-redis 6.3.0 `timeout` solo acota la espera de un comando antes de enviarse y no hay timeout de socket; es un hueco que ya tenía el cliente anterior. Quien
 * lo necesite lo pone al llamar (p. ej. con `PromiseTimeout`). `bulkHIncrBy` sí lo tiene (`timeoutMs`).
 *
 * Terminar el proceso: el cliente no suelta el proceso por sí solo (sus temporizadores de PING y reconexión no se pueden soltar). Los jobs y cronjobs (`pod.cronjob`,
 * que incluye el tipo `job`, `@mr/core/dev/manifest/deployment/index.ts`) acaban con `process.exit()`; un job declarado como `service` no, y un cliente que reconecta lo
 * mantendría vivo. Un script sin `Main` debe hacer `await redis[Symbol.asyncDispose]()`; tras liberar con Redis caído, el proceso puede tardar hasta
 * `maxReconnectDelayMs` + 250 ms (~5,25 s por defecto) en salir.
 */
export class Redis implements AsyncDisposable {
    /* STATIC */

    /**
     * Construye un `Error` enriquecido con contexto de operación y causa original.
     *
     * @param message Mensaje contextual de la operación que ha fallado.
     * @param err Error capturado durante la operación asíncrona.
     * @returns Instancia de `Error` con detalle contextual y la causa original en `cause`.
     */
    private static buildPromiseError(message: string, err: unknown): Error {
        const errorMessage = err instanceof Error ? err.message : String(err);
        return new Error(`${message}. Causa: ${errorMessage}`, {cause: err});
    }

    /**
     * Crea una instancia de cliente Redis.
     *
     * @param config Parámetros de creación del cliente.
     */
    public static build({pod, credenciales = 'files/credenciales/redis.json', options}: IRedisBuild): Redis {
        if (options) {
            this.validateOptions(options);
        }
        return new this(pod, credenciales, options);
    }

    /**
     * Comprueba las opciones de `IRedisOptions` que admiten un valor absurdo, al crear el cliente y no en medio de una avería.
     *
     * @param options Opciones recibidas.
     * @throws {RangeError} Si `singleNode`, `logThrottleMs` o `maxReconnectDelayMs` no son números válidos.
     */
    private static validateOptions({singleNode, logThrottleMs, maxReconnectDelayMs}: IRedisOptions): void {
        if (singleNode !== undefined && (!Number.isInteger(singleNode) || singleNode < 0)) {
            throw new RangeError(`singleNode (${singleNode}) debe ser un entero mayor o igual que 0`);
        }
        if (logThrottleMs !== undefined && (!Number.isFinite(logThrottleMs) || logThrottleMs < 0)) {
            throw new RangeError(`logThrottleMs (${logThrottleMs}) debe ser un número mayor o igual que 0`);
        }
        if (maxReconnectDelayMs !== undefined && (!Number.isFinite(maxReconnectDelayMs) || maxReconnectDelayMs <= 0)) {
            throw new RangeError(`maxReconnectDelayMs (${maxReconnectDelayMs}) debe ser un número mayor que 0`);
        }
    }

    /* INSTANCE */
    private _cluster?: Promise<RedisCluster>;
    private readonly throttle: LogThrottle | null;
    private constructor(
        protected readonly config: IPodInfo,
        private readonly credenciales: string,
        private readonly options: IRedisOptions = {}
    ) {
        const throttleMs = options.logThrottleMs ?? 60_000;
        this.throttle = throttleMs > 0 ? new LogThrottle(throttleMs) : null;

        if (options.connectOnBuild) {
            this.cluster.catch(err => {
                this.warn(`Error al crear el cliente de REDIS`, err);
            });
        }
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

    /**
     * Escribe un aviso de un método con Redis en problemas, con un solo aviso por tipo de error y por `logThrottleMs`: con Redis caído cada operación fallaría y
     * el log se llenaría. El tipo es el de la causa original (`ECONNREFUSED`, `ClientOfflineError`...), no el de la operación ni el de la clave.
     *
     * @param message Mensaje del aviso.
     * @param err Error capturado.
     */
    private warn(message: string, err: unknown): void {
        if (this.throttle !== null) {
            const cause = err instanceof Error && err.cause !== undefined ? err.cause : err;
            const muted = this.throttle.allow(errorType(cause), Date.now());
            if (muted === null) {
                return;
            }
            if (muted > 0) {
                message = `${message} (${muted} avisos iguales callados)`;
            }
        }
        warning(message, err);
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

                try {
                    return new RedisCluster(primaries, read, this.options);
                } catch (e) {
                    error(`Configuración de REDIS inválida`, e);
                    throw e;
                }
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
            this.warn(`Error obteniendo ${key} de REDIS`, e);
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
            if (response && (!response.expires || (response.expires > 0 && Date.now() <= response.expires))) { // TODO: Cambiar uso de la expiración cuando se actualice a la 7.4 de Redis (hExpire)
                return {[field]: response.data} as unknown as { [field: string]: string };
            }
        } catch (e) {
            this.warn(`Error obteniendo ${key} de REDIS`, e);
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
                    return !value.expires || (value.expires > 0 && Date.now() <= value.expires); // TODO: Cambiar uso de la expiración cuando se actualice a la 7.4 de Redis (hExpire)
                });

            return {
                ...fields.reduce((acc, field) => {
                    const value = JSON.parse(response[field]);
                    acc[field] = value.data;
                    return acc;
                }, {} as {[field: string]: string})
            } as {[field: string]: string}|null;
        } catch (e) {
            this.warn(`Error obteniendo ${key} de REDIS`, e);
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
            this.warn(`Error guardando ${key} en REDIS`, e);
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
            this.warn(`Error guardando ${key} en REDIS`, e);
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
            this.warn(`Error guardando ${key} en REDIS`, e);
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
                // Si es un array, las claves que no existen llegan como null (ver `get`) y se mantienen como null
                return (data as (Buffer|null)[]).map(aData => aData ? JSON.parse(aData.toString('utf-8')) as T : null) as T[];
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
        if (items.length === 0) {return;}

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
            this.warn(`Error buscando keys con patrón ${pattern} en REDIS`, e);
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
            this.warn(`Error buscando max score con patrón ${pattern} en REDIS`, e);
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
            this.warn(`Error adquiriendo lock para keys ${keys.join(', ')} en REDIS`, e);
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
            this.warn(`Error liberando lock para keys ${keys.join(', ')} en REDIS`, e);
        }

    }

    /**
     * Suma incrementos a campos de hash en **un solo nodo** (el nodo único, `options.singleNode`, por defecto el primer primario), todo el lote en
     * una transacción `MULTI/EXEC`: un `HINCRBY` por elemento y un `EXPIRE` por clave, con el mayor `ttl` que pida el lote para ella. A
     * diferencia de `set`/`bulkSet`, **no se replica en todos los primarios y no hay failover**: un incremento repetido se contaría dos veces.
     * Las claves llevan el prefijo de namespace salvo con `shared`. Los hashes que escribe son contadores crudos: no llevan el envoltorio
     * `{expires, data}` de `hSet`, así que se leen con `bulkHGetAll`, no con `hGetAll`.
     *
     * Nunca rechaza por un fallo de Redis (conexión, timeout, error del servidor): el resultado dice qué pasó. `notSent` incluye no poder
     * obtener las credenciales o el cliente.
     *
     * - `ok`: el `EXEC` se confirmó.
     * - `notSent`: no salió nada; reintentar con los mismos datos es seguro.
     * - `ambiguous`: pudo aplicarse o no; reintentar puede contar dos veces y no reintentar puede perder el lote.
     *
     * En node-redis 6.3.0 `MULTI` ignora `commandOptions.timeout` y la cola offline, así que el timeout (`timeoutMs`, por defecto
     * `options.timeout || 10` ms) se aplica aquí con un temporizador propio y sin conexión lista no se envía nada.
     *
     * @param items Incrementos del lote.
     * @param options `shared` para omitir el namespace y `timeoutMs` para el tiempo máximo del `EXEC`.
     * @returns Resultado del lote. Un lote vacío es `ok`.
     * @throws {RangeError} Si algún `increment` no es un entero seguro distinto de 0 o algún `ttl` no es un entero mayor que 0.
     */
    public async bulkHIncrBy(items: IHIncrBy[], {shared = false, timeoutMs}: IBulkHIncrByOptions = {}): Promise<TBatchResult> {
        const batch = new RedisBatch(items.map(item => ({...item, key: this.buildKey(item.key, shared)})));
        if (items.length === 0) {
            return "ok";
        }

        let client: RedisClientType;
        try {
            const cluster = await this.cluster;
            client = await cluster.single;
        } catch (e) {
            // Sin conexión lista no se avisa: el resultado ya lo dice y el clúster ya registra el error de conexión, con su límite.
            if (!(e instanceof ClientOfflineError)) {
                this.warn(`Error obteniendo cliente para bulkHIncrBy`, e);
            }
            return "notSent";
        }

        return await batch.execute(client, timeoutMs ?? (this.options.timeout || 10));
    }

    /**
     * Lee varios hashes enteros, en crudo, con un `HGETALL` por clave lanzados en paralelo (no un `MULTI`: así conservan el timeout del comando y
     * se rechazan al instante si no hay conexión). Es la contrapartida de `bulkHIncrBy`: devuelve los campos tal cual están en Redis, **sin**
     * interpretar el envoltorio `{expires, data}` de `hSet`. Lee por defecto del nodo único. A diferencia de `hGetAll`, **propaga los errores**
     * (como `bulkSet`/`bulkHSet`), así que la llamada debe capturarlos.
     *
     * @param keys Claves de los hashes.
     * @param options `shared` para omitir el namespace y `node` para elegir de qué nodo se lee.
     * @returns Un elemento por clave, en el mismo orden: el hash, o `null` si no existe o está vacío.
     */
    public async bulkHGetAll(keys: string[], {shared = false, node = "single"}: IBulkHGetAllOptions = {}): Promise<(Record<string, string>|null)[]> {
        if (keys.length === 0) {
            return [];
        }

        const cluster = await this.cluster;
        const client = await (node === "read" ? cluster.read : cluster.single);

        const replies = await Promise.all(keys.map(key => client.hGetAll(this.buildKey(key, shared))));
        return replies.map(reply => {
            const fields: Record<string, string> = {...reply};
            if (Object.keys(fields).length === 0) {
                return null;
            }
            return fields;
        });
    }

    /**
     * Fija la caducidad de una clave. Es idempotente: repetirla solo renueva el plazo. Por defecto se aplica en **todos** los primarios, como
     * `set`; con `target: "single"`, solo en el nodo único (la pareja de `bulkHIncrBy`). **Propaga los errores**, así que la llamada debe
     * capturarlos. Si la clave no existe no hace nada. Un `ttl` que no sea un entero mayor que 0 se rechaza: Redis borraría la clave.
     *
     * @param key Clave lógica (sin prefijo).
     * @param ttl Segundos hasta la caducidad.
     * @param options `shared` para omitir el namespace y `target` para elegir los nodos.
     * @throws {RangeError} Si `ttl` no es un entero seguro mayor que 0.
     */
    public async expire(key: string, ttl: number, {shared = false, target = "all"}: IExpireOptions = {}): Promise<void> {
        if (!Number.isSafeInteger(ttl) || ttl <= 0) {
            throw new RangeError(`ttl (${ttl}) debe ser un entero mayor que 0`);
        }

        const cluster = await this.cluster;
        const theKey = this.buildKey(key, shared);

        if (target === "single") {
            const client = await cluster.single;
            await client.expire(theKey, ttl);
            return;
        }

        const primaryClients = await Promise.all(cluster.primaries);
        await Promise.all(primaryClients.map(async client => {
            await client.expire(theKey, ttl);
        }));
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
