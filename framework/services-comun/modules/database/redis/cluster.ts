/**
 * Editor: Juan C. Martínez
 * Fecha: Mon, 02 Nov 2026 11:05:48 GMT
 * Hash: 26ca3881665dd988afdfedf47a1a4f07
 * Versión: 2026.11.2+2-juancmartinez
 * Proyecto: git@github.com:alpred/meteored-svc-cmp.git
 */

/**
 * Clúster de clientes Redis de `Redis` (ver `index.ts`). Es interno de `modules/database/redis`: lo construye `Redis`, no se usa desde fuera.
 *
 * Cada cliente se crea una vez y node-redis lo reconecta solo, con espera exponencial y sin rendirse nunca. Ante un error no se destruye ni se
 * recrea nada: `on('error')` solo registra. Sin conexión no hay cola offline (`disableOfflineQueue`): los comandos fallan al instante en vez
 * de acumularse en memoria y de dejar al llamante esperando a que Redis vuelva.
 */

import {ClientOfflineError, createClient, type RedisClientType} from "redis";

import {error, info, warning} from "../../utiles/log";
import {errorType, LogThrottle} from "../../utiles/log-throttle";
import {Deferred, PromiseTimeout} from "../../utiles/promise";

/**
 * Nodo de Redis, como lo guarda `files/credenciales/redis.json`.
 *
 * @property host - Host.
 * @property port - Puerto, como texto.
 */
export interface IRedisNode {
    host: string;
    port: string;
}

/**
 * Opciones que lee `RedisCluster` (subconjunto de `IRedisOptions`).
 *
 * @property timeout             - Timeout de los comandos (ms). Por defecto 10.
 * @property clientTimeout       - Timeout de cada intento de conexión (ms). Por defecto 50. Las operaciones sobre un nodo que aún no ha conectado
 *                                 nunca esperan a que conecte durante `4 × clientTimeout + 700 ms` desde que se creó el clúster (los cuatro primeros
 *                                 intentos con sus esperas nominales de 100, 200 y 400 ms, sin contar el azar).
 * @property logThrottleMs       - Un solo log de error por tipo y por este intervalo (ms); 0 lo desactiva. Por defecto 60 000.
 * @property singleNode          - Índice, en la lista de primarios, del nodo de las operaciones de un solo nodo. Por defecto 0.
 * @property maxReconnectDelayMs - Tope de la espera entre reconexiones (ms). Por defecto 5 000.
 */
export interface IClusterOptions {
    timeout?: number;
    clientTimeout?: number;
    logThrottleMs?: number;
    singleNode?: number;
    maxReconnectDelayMs?: number;
}

/**
 * Opciones de `RedisCluster.reconnectDelay`.
 *
 * @property random - Valor en `[0, 1)` que aporta el azar; se inyecta para poder probar la función. Por defecto `Math.random()`.
 * @property maxMs  - Tope de la espera exponencial, en milisegundos. Por defecto `RedisCluster.MAX_RECONNECT_DELAY_MS` (5 000).
 */
export interface IReconnectDelayOptions {
    random?: number;
    maxMs?: number;
}

/**
 * Comprueba que `singleNode` es un índice válido de la lista de primarios.
 *
 * @param singleNode Índice pedido.
 * @param total Número de primarios que hay en las credenciales.
 * @throws {RangeError} Si no es un entero entre 0 y `total - 1`. No se cae al nodo 0 en silencio: un índice mal escrito mandaría los datos a otro nodo.
 */
export function validateSingleNode(singleNode: number, total: number): void {
    if (!Number.isInteger(singleNode) || singleNode < 0 || singleNode >= total) {
        throw new RangeError(`singleNode (${singleNode}) fuera de rango: las credenciales tienen ${total} primario(s) (0..${total - 1})`);
    }
}

/**
 * Versión mínima de `redis` (node-redis) para la que se han medido estos comportamientos.
 */
const MIN_REDIS_VERSION = [6, 3, 0];

/**
 * El aviso de versión se da una sola vez por proceso.
 */
let versionChecked = false;

/**
 * Indica si una versión semver (`6.2.1`, `5.0.0-beta.1`...) es anterior a la mínima. Una versión que no se entiende no es anterior: no se avisa por ella.
 *
 * @param version Versión leída de `redis/package.json`.
 */
export function isOlderRedis(version: string): boolean {
    const parts = /^(\d+)\.(\d+)\.(\d+)/.exec(version);
    if (parts === null) {
        return false;
    }
    for (let i = 0; i < MIN_REDIS_VERSION.length; i++) {
        const part = Number(parts[i + 1]);
        if (part !== MIN_REDIS_VERSION[i]) {
            return part < MIN_REDIS_VERSION[i];
        }
    }
    return false;
}

/**
 * Lee la versión de `redis` con un `require` de su `package.json` (sin restricción de `exports`): sirve con Yarn PnP y, en un bundle de rspack, `redis` es
 * externo y su subruta también. Donde no hay `require` (módulos ESM, como el arnés de pruebas de cmp-web) no hay forma limpia de leerla: se devuelve `null`.
 */
export function redisVersion(): string | null {
    try {
        if (typeof require !== "function") {
            return null;
        }
        const version = (require("redis/package.json") as {version?: unknown}).version;
        return typeof version === "string" ? version : null;
    } catch {
        return null;
    }
}

/**
 * Escribe un `warning` si la versión de `redis` es anterior a 6.3.0: los comportamientos de este clúster se han medido con esa versión; antes, un socket muerto
 * durante el handshake dejaba el cliente sin conexión para siempre (6.0 y 6.1) y `destroy()` podía lanzar.
 *
 * @param version Versión de `redis`, o `null` si no se ha podido leer (entonces no se avisa).
 * @returns `true` si ha avisado.
 */
export function warnIfOldRedis(version: string | null): boolean {
    if (version === null || !isOlderRedis(version)) {
        return false;
    }
    warning(`REDIS: la versión de node-redis es ${version}; este cliente está medido con la 6.3.0 o posterior y con una anterior puede no reconectar o fallar al cerrar`);
    return true;
}

/**
 * Comprueba la versión de `redis` una sola vez por proceso, sin abortar.
 */
function checkRedisVersion(): void {
    if (versionChecked) {
        return;
    }
    versionChecked = true;
    warnIfOldRedis(redisVersion());
}

/**
 * Clúster de clientes que se reconectan solos y no se recrean nunca.
 *
 * - `connect()` se lanza al crearlo y no se espera: se abre una conexión por cada primario y otra para `read` si es un nodo distinto. Las propiedades
 *   `primaries`, `read` y `single` devuelven el cliente ya resuelto si está listo (`isReady`). Si no lo está y ya conectó alguna vez, rechazan al
 *   instante con `ClientOfflineError`. Si aún no ha conectado nunca (arranque), esperan a la primera conexión, pero solo durante la ventana de gracia
 *   (`4 × clientTimeout + 700 ms` desde que se creó el clúster); pasada sin conexión rechazan al instante igual que en cualquier otra caída.
 * - `on('error')` solo registra, con un solo log por tipo e intervalo (`logThrottleMs`).
 * - Si `read` es el mismo host y puerto que un primario, comparte su cliente.
 * - Se cierra con `close()` acotado y, si no responde, `destroy()`; una conexión que termine su handshake después de cerrar se destruye.
 *
 * Tras cerrar con Redis caído, el proceso puede tardar hasta `maxReconnectDelayMs` + 250 ms (~5,25 s por defecto) en salir: node-redis 6.3.0 espera el
 * reintento pendiente con un temporizador que no se puede cancelar ni soltar.
 */
export class RedisCluster implements AsyncDisposable {
    /* STATIC */

    /**
     * Espera máxima por defecto entre intentos de reconexión, en milisegundos.
     */
    public static readonly MAX_RECONNECT_DELAY_MS = 5_000;

    private static readonly COMMAND_TIMEOUT_MS = 10;
    private static readonly CONNECT_TIMEOUT_MS = 50;
    private static readonly GRACE_ATTEMPTS = 4;
    private static readonly GRACE_EXTRA_MS = 700;
    private static readonly CLOSE_TIMEOUT_MS = 2_000;
    private static readonly CLOSE_CONNECT_WAIT_MS = 200;
    private static readonly PING_INTERVAL_MS = 10_000;
    private static readonly LOG_THROTTLE_MS = 60_000;

    /**
     * Espera antes del siguiente intento de reconexión: exponencial desde 100 ms, con tope en `maxMs` y algo de azar (hasta 250 ms) para que los
     * pods no reconecten todos a la vez. Siempre devuelve un número: una estrategia de reconexión que no se rinde nunca no puede devolver un error.
     *
     * @param attempts Número de intentos fallidos hasta ahora (0 es el primero).
     * @param options Ver `IReconnectDelayOptions`.
     */
    public static reconnectDelay(attempts: number, {random = Math.random(), maxMs = RedisCluster.MAX_RECONNECT_DELAY_MS}: IReconnectDelayOptions = {}): number {
        const exponent = Math.min(Math.max(0, attempts), 20);
        return Math.min(100 * 2 ** exponent, maxMs) + Math.floor(random * 250);
    }

    /* INSTANCE */

    private readonly options: IClusterOptions;
    private readonly clients: RedisClientType[];
    private readonly readClient: RedisClientType;
    private readonly firstReady: Map<RedisClientType, Deferred<void>>;
    private readonly graceEnd: number;
    private readonly throttle: LogThrottle | null;
    private closing: Promise<void> | null;

    public get primaries(): Promise<RedisClientType>[] {
        return this.clients.map(client => this.available(client));
    }

    public get read(): Promise<RedisClientType> {
        return this.available(this.readClient);
    }

    public get single(): Promise<RedisClientType> {
        return this.available(this.clients[this.options.singleNode ?? 0]);
    }

    /**
     * Crea los clientes y empieza a conectar sin esperar.
     *
     * @param primaries Primarios de las credenciales, en orden.
     * @param read Nodo de lectura; si no se indica se lee del primer primario.
     * @param options Ver `IClusterOptions`.
     * @throws {RangeError} Si `options.singleNode` no es un índice válido de `primaries`.
     */
    public constructor(primaries: IRedisNode[], read: IRedisNode | undefined, options: IClusterOptions = {}) {
        validateSingleNode(options.singleNode ?? 0, primaries.length);
        checkRedisVersion();

        this.options = options;
        this.closing = null;
        this.firstReady = new Map();
        this.graceEnd = Date.now() + (options.clientTimeout || RedisCluster.CONNECT_TIMEOUT_MS) * RedisCluster.GRACE_ATTEMPTS + RedisCluster.GRACE_EXTRA_MS;

        const throttleMs = options.logThrottleMs ?? RedisCluster.LOG_THROTTLE_MS;
        this.throttle = throttleMs > 0 ? new LogThrottle(throttleMs) : null;

        this.clients = primaries.map(node => this.buildClient(node, "primary"));

        const shared = read === undefined ? 0 : primaries.findIndex(node => node.host === read.host && node.port === read.port);
        if (shared >= 0) {
            this.readClient = this.clients[shared];
        } else {
            this.readClient = this.buildClient(read as IRedisNode, "read");
        }
    }

    public async [Symbol.asyncDispose](): Promise<void> {
        await this.close();
    }

    private available(client: RedisClientType): Promise<RedisClientType> {
        if (client.isReady) {
            return Promise.resolve(client);
        }

        const first = this.firstReady.get(client) as Deferred<void>;
        if (first.state === "fulfilled") {
            return Promise.reject(new ClientOfflineError());
        }

        // Aún no ha conectado nunca (arranque): se espera a la primera conexión, pero solo dentro de la ventana de gracia que empieza al crear el
        // clúster. Pasada la ventana, con Redis caído desde el principio, cada operación falla al instante en vez de esperar de nuevo.
        const remainingMs = this.graceEnd - Date.now();
        if (remainingMs <= 0) {
            return Promise.reject(new ClientOfflineError());
        }
        return PromiseTimeout(first.promise, remainingMs).then(() => client, () => {
            return Promise.reject(new ClientOfflineError());
        });
    }

    private buildClient(node: IRedisNode, role: "primary" | "read"): RedisClientType {
        const client: RedisClientType = createClient({
            url: `redis://${node.host}:${node.port}`,
            disableOfflineQueue: true,
            pingInterval: RedisCluster.PING_INTERVAL_MS, // PING automático para mantener vivo el canal en GCP
            socket: {
                keepAlive: true,
                connectTimeout: this.options.clientTimeout || RedisCluster.CONNECT_TIMEOUT_MS,
                reconnectStrategy: (attempts: number) => RedisCluster.reconnectDelay(attempts, {maxMs: this.options.maxReconnectDelayMs ?? RedisCluster.MAX_RECONNECT_DELAY_MS}),
            },
            commandOptions: {
                timeout: this.options.timeout || RedisCluster.COMMAND_TIMEOUT_MS,
            },
        });

        const first = new Deferred<void>();
        this.firstReady.set(client, first);
        client.once("ready", () => {
            first.resolve();
        });

        // Una conexión que termina su handshake cuando ya se ha cerrado el clúster (o se le ha hecho `destroy()` a medias) queda viva: se destruye.
        client.on("ready", () => {
            if (this.closing !== null) {
                this.destroyClient(client);
            }
        });

        // Sin un listener de `error`, node-redis lanza el error y tira el proceso.
        client.on("error", (err: unknown) => {
            this.report(node, role, err);
        });

        // Con una estrategia de reconexión que no se rinde, `connect()` solo termina al conectar (o rechaza si se cierra antes).
        client.connect().then(() => {
            info(`Conectado a REDIS (${role} ${node.host}:${node.port})`);
        }, (err: unknown) => {
            if (this.closing === null) {
                this.report(node, role, err);
            }
        });

        return client;
    }

    private report(node: IRedisNode, role: string, err: unknown): void {
        const context = `${role} ${node.host}:${node.port}`;
        let suffix = "";
        if (this.throttle !== null) {
            const muted = this.throttle.allow(`${context}:${errorType(err)}`, Date.now());
            if (muted === null) {
                return;
            }
            if (muted > 0) {
                suffix = ` (${muted} errores iguales callados)`;
            }
        }
        error(`Redis Client Error (${context})${suffix}`, err);
    }

    private close(): Promise<void> {
        if (this.closing === null) {
            const distinct = [...new Set([...this.clients, this.readClient])];
            this.closing = Promise.all(distinct.map(client => this.closeClient(client))).then(() => undefined);
        }
        return this.closing;
    }

    private async closeClient(client: RedisClientType): Promise<void> {
        if (!client.isOpen) {
            return;
        }

        // Un cliente al que aún no le ha dado tiempo a conectar por primera vez puede estar en mitad del handshake: node-redis 6.3.0 no lo aborta bien con
        // `destroy()` (termina de conectar igualmente y su temporizador de PING se queda rearmándose para siempre, sin dejar salir al proceso). Se le da un
        // momento para terminar; con Redis caído no hay handshake en curso y el plazo vence sin más.
        const first = this.firstReady.get(client);
        if (!client.isReady && first !== undefined && first.state === "pending") {
            await PromiseTimeout(first.promise, RedisCluster.CLOSE_CONNECT_WAIT_MS).catch(() => undefined);
        }

        if (!client.isReady) {
            this.destroyClient(client);
            return;
        }
        try {
            await PromiseTimeout(client.close(), RedisCluster.CLOSE_TIMEOUT_MS);
        } catch (e) {
            warning(`REDIS no respondió al cerrar. Destruyendo el cliente`, e);
            this.destroyClient(client);
        }
    }

    /**
     * `destroy()` que no lanza: en versiones de node-redis anteriores a la 6.3 puede hacerlo si el cliente ya está cerrado.
     */
    private destroyClient(client: RedisClientType): void {
        try {
            client.destroy();
        } catch (e) {
            warning(`REDIS no se pudo destruir el cliente`, e);
        }
    }
}
