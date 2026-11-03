/**
 * Editor: Juan C. Martínez
 * Fecha: Mon, 02 Nov 2026 11:05:48 GMT
 * Hash: 534ab6d47e9533aa537844e2898f501e
 * Versión: 2026.11.2+2-juancmartinez
 * Proyecto: git@github.com:alpred/meteored-svc-cmp.git
 */

/**
 * Lote de incrementos de contadores en Redis (`Redis.bulkHIncrBy`): `RedisBatch` valida los incrementos, agrupa los TTL, ejecuta la transacción y clasifica los
 * errores. No importa `redis` (los clientes se tipan de forma estructural para poder probarlo con un *fake*), así que se prueba sin servidor.
 *
 * Detalle de node-redis 6.3.0 que condiciona `RedisBatch.execute`: `MULTI` ignora `disableOfflineQueue` y `commandOptions.timeout` (solo los aplica
 * `sendCommand`). Sin conexión, el `MULTI` se encolaría hasta reconectar y saldría tarde y como «ambiguous». Por eso se comprueba `isReady` antes
 * de enviar y el `EXEC` se acota con un temporizador propio.
 */

import {PromiseTimeout} from "../../utiles/promise";

/**
 * Resultado de escribir un lote.
 *
 * - `ok`: Redis confirmó el `EXEC`: todo el lote está aplicado.
 * - `notSent`: el lote **no llegó a enviarse** (cliente desconectado, cerrado o cola rechazada antes de escribir). Es seguro reintentarlo con
 *   los mismos datos: no se contaría dos veces.
 * - `ambiguous`: el lote pudo haberse enviado y no se sabe si se aplicó (timeout, corte de la conexión o error del servidor tras el envío).
 *   Reintentarlo puede contar dos veces; no reintentarlo puede perder el lote. Quien llama elige qué prefiere.
 */
export type TBatchResult = "ok" | "notSent" | "ambiguous";

/**
 * Incremento de un campo de un hash.
 *
 * @property key       - Clave del hash.
 * @property field     - Campo del hash.
 * @property increment - Cantidad a sumar; entero seguro distinto de 0 (puede ser negativo).
 * @property ttl       - Caducidad (segundos) que se renueva en la clave; entero mayor que 0. Con varios incrementos de la misma clave en el
 *                       lote se aplica el mayor.
 */
export interface IHIncrBy {
    key: string;
    field: string;
    increment: number;
    ttl: number;
}

/**
 * Transacción mínima que necesita `RedisBatch.execute`. `RedisClientType.multi()` la cumple.
 */
export interface IBatchMulti {
    hIncrBy(key: string, field: string, increment: number): unknown;
    expire(key: string, seconds: number): unknown;
    exec(): Promise<unknown[]>;
}

/**
 * Cliente mínimo que necesita `RedisBatch.execute`. `RedisClientType` lo cumple.
 *
 * @property isReady - `true` solo con la conexión establecida y lista para enviar.
 */
export interface IBatchClient {
    readonly isReady: boolean;
    multi(): IBatchMulti;
}

/**
 * Un lote de incrementos de campos de hash para escribir en una sola transacción.
 *
 * Al crearlo se valida y se agrupan los TTL (un solo `EXPIRE` por clave, con el mayor que pida el lote). `execute` envía todo en un `MULTI/EXEC` y dice qué pasó, sin
 * rechazar nunca por un fallo de Redis.
 */
export class RedisBatch {
    /* STATIC */

    /**
     * Errores de node-redis que garantizan que el comando no salió del cliente, por el nombre de su clase (`constructor.name`):
     * - `ClientOfflineError`: cliente sin conexión con `disableOfflineQueue`.
     * - `ClientClosedError`: cliente cerrado.
     * - `AbortError`: señal de cancelación ya activada antes de encolar.
     */
    private static readonly NOT_SENT_ERRORS: readonly string[] = ["ClientOfflineError", "ClientClosedError", "AbortError"];

    /**
     * Mensaje (no tiene clase propia) con el que node-redis rechaza un comando cuando `commandsQueueMaxLength` está lleno.
     *
     * Es `notSent` porque en node-redis 6.3.0 `addCommand` lo rechaza **antes** de poner el comando en la cola (`Promise.reject` al empezar, sin tocar `#toWrite`) y la
     * propia librería lo cuenta entre los errores «previos al encolado» (`isPreEnqueueError`: el servidor nunca vio el comando). En una transacción, el rechazo de un
     * comando intermedio deja sin enviar el `EXEC`, así que tampoco se aplica nada. Este cliente no fija `commandsQueueMaxLength`, de modo que en la práctica no se da.
     */
    private static readonly QUEUE_FULL_MESSAGE = "The queue is full";

    /**
     * Clasifica el error de un lote de escritura.
     *
     * Depende del `constructor.name` de los errores de node-redis (no de `instanceof`, para no necesitar el mismo ejemplar de la librería): si un bundler minificara los nombres
     * de clase, todo se clasificaría como `ambiguous`, que es el lado seguro.
     *
     * Criterio: solo es `notSent` si el error prueba que **nada salió del cliente** (los de `NOT_SENT_ERRORS` y la cola llena). Cualquier otro
     * error —`PromiseTimeoutError`, `TimeoutError`, `SocketClosedUnexpectedlyError`, `ErrorReply`, un error desconocido— es `ambiguous`, porque pudo
     * ocurrir después de escribir en el socket. Ante la duda, `ambiguous`.
     *
     * @param err Error capturado.
     */
    public static classifyError(err: unknown): Exclude<TBatchResult, "ok"> {
        if (err instanceof Error) {
            if (RedisBatch.NOT_SENT_ERRORS.includes(err.constructor.name) || err.message === RedisBatch.QUEUE_FULL_MESSAGE) {
                return "notSent";
            }
        }
        return "ambiguous";
    }

    /* INSTANCE */

    public readonly items: IHIncrBy[];
    public readonly ttls: Map<string, number>;

    /**
     * Valida los incrementos y agrupa sus TTL.
     *
     * @param items Incrementos del lote. Las claves son las que se enviarán a Redis (ya con su prefijo, si lo llevan).
     * @throws {RangeError} Si algún `increment` no es un entero seguro distinto de 0 o algún `ttl` no es un entero mayor que 0.
     */
    public constructor(items: IHIncrBy[]) {
        this.ttls = new Map();
        for (const {key, field, increment, ttl} of items) {
            if (!Number.isSafeInteger(increment) || increment === 0 || !Number.isSafeInteger(ttl) || ttl <= 0) {
                throw new RangeError(`Lote inválido (${key}/${field}): increment (${increment}) debe ser un entero distinto de 0 y ttl (${ttl}) un entero mayor que 0`);
            }
            this.ttls.set(key, Math.max(this.ttls.get(key) ?? 0, ttl));
        }
        this.items = items;
    }

    /**
     * Ejecuta el lote en una única transacción (`MULTI/EXEC`: un `HINCRBY` por incremento y un `EXPIRE` por clave) y dice qué pasó, sin rechazar nunca por un fallo de Redis.
     *
     * - Cliente sin conexión lista (`!isReady`): `notSent`, sin tocar el cliente.
     * - `EXEC` confirmado y sin errores dentro del resultado: `ok`.
     * - `EXEC` con algún comando fallido dentro del resultado: `ambiguous` (parte del lote pudo aplicarse).
     * - Error: ver `classifyError`. El timeout propio (`timeoutMs`) es `ambiguous`: el `EXEC` pudo haber llegado.
     *
     * @param client Cliente con el que se envía.
     * @param timeoutMs Tiempo máximo (ms) que se espera al `EXEC`.
     */
    public async execute(client: IBatchClient, timeoutMs: number): Promise<TBatchResult> {
        if (!client.isReady) {
            return "notSent";
        }

        try {
            const multi = client.multi();
            for (const {key, field, increment} of this.items) {
                multi.hIncrBy(key, field, increment);
            }
            for (const [key, ttl] of this.ttls) {
                multi.expire(key, ttl);
            }
            const replies = await PromiseTimeout(multi.exec(), timeoutMs);
            if (replies.some(reply => reply instanceof Error)) {
                return "ambiguous";
            }
            return "ok";
        } catch (err) {
            return RedisBatch.classifyError(err);
        }
    }
}
