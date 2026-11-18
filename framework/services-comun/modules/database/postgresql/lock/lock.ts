/**
 * Editor: Juan C. Martínez
 * Fecha: Tue, 17 Nov 2026 09:24:35 GMT
 * Hash: 6ed01c36952f87e0477dff10b3963b59
 * Versión: 2026.11.17+1-juancmartinez
 * Anterior: 2026.9.23+3-bixus
 * Proyecto: git@github.com:alpred/meteored-svc-localizacion.git
 */

import type {Pool, PoolClient} from "pg";

import {debug, warning} from "../../../utiles/log";

/**
 * Bloqueo consultivo (`pg_advisory_*`) de PostgreSQL, con la clave `hashtext(nombre)`.
 *
 * Hay DOS modos, y no son intercambiables:
 *
 * - {@link Lock.acquire}: bloqueante (`pg_advisory_lock`) y pensado para el `listen()` del cluster. Toma y suelta el bloqueo con `pool.query`, que puede caer en conexiones DISTINTAS del
 *   pool: el bloqueo es de SESION, asi que el `unlock` puede no encontrarlo y el bloqueo queda en la conexion que lo tomo. No se usa para nada nuevo.
 * - {@link Lock.tryAcquire}: no bloqueante (`pg_try_advisory_lock`) y **con una conexion propia** del pool que se queda reservada mientras se tenga el bloqueo; `release()` lo suelta en ESA
 *   misma conexion y la devuelve. Es el que expone `PostgreSQL.tryLock()`. Si la conexion se pierde, el servidor suelta el bloqueo solo (y se avisa en el log): quien lo tiene no se entera
 *   hasta que lo use, asi que no sirve para proteger algo que no se pueda repetir.
 *
 * Un bloqueo de sesion exige una conexion directa, NO un pooler en modo transaccion (PgBouncer): ver `PostgreSQLCluster.lockPool()`.
 */
/**
 * La conexion propia de un bloqueo tomado con {@link Lock.tryAcquire}, con el oyente de `error` que se le puso.
 */
interface ILockSession {
    client: PoolClient;
    onError: (err: Error) => void;
}

export class Lock {
    /* STATIC */
    public static async acquire(name: string, pool: Pool): Promise<Lock|null> {
        try {
            debug(`Acquiring lock: ${name}`);
            await pool.query(`SELECT pg_advisory_lock(hashtext($1))`, [name]);
            return new Lock(name, pool);
        } catch (e) {
            if (DESARROLLO) {
                warning(`Lock acquire error`, e);
            }
            throw e;
        }
    }

    /**
     * Intenta tomar el bloqueo SIN esperar, en una conexion propia del pool.
     *
     * @returns El bloqueo, o `null` si otra sesion lo tiene. Rechaza si no hay conexion o la consulta falla (la conexion se descarta, no se devuelve al pool).
     */
    public static async tryAcquire(name: string, pool: Pool): Promise<Lock|null> {
        const client = await pool.connect();
        const onError = (err: Error): void => {
            warning(`Lock connection error (${name}): the lock is lost if it was held`, err);
        };
        client.on("error", onError);
        try {
            debug(`Trying lock: ${name}`);
            const {rows} = await client.query<{locked: boolean}>(`SELECT pg_try_advisory_lock(hashtext($1)) AS locked`, [name]);
            if (rows[0]?.locked !== true) {
                Lock.giveBack(client, onError);
                return null;
            }
            return new Lock(name, pool, {client, onError});
        } catch (e) {
            Lock.giveBack(client, onError, e instanceof Error ? e : new Error(String(e)));
            throw e;
        }
    }

    private static giveBack(client: PoolClient, onError: (err: Error) => void, err?: Error): void {
        client.removeListener("error", onError);
        client.release(err);
    }

    /* INSTANCE */
    private readonly name: string;
    private readonly pool: Pool;
    private readonly session: ILockSession|undefined;
    private released: boolean;

    private constructor(name: string, pool: Pool, session?: ILockSession) {
        this.name = name;
        this.pool = pool;
        this.session = session;
        this.released = false;
    }

    public async release(): Promise<void> {
        debug(`Releasing lock: ${this.name}`);
        const session = this.session;
        if (session === undefined) {
            // Liberar el lock (modo `acquire`)
            await this.pool.query(`SELECT pg_advisory_unlock(hashtext($1))`, [this.name]);
            return;
        }
        // Modo `tryAcquire`: se suelta en la MISMA conexion que lo tomo, y solo una vez.
        if (this.released) {
            return;
        }
        this.released = true;
        let fallo: Error|undefined;
        try {
            const {rows} = await session.client.query<{unlocked: boolean}>(`SELECT pg_advisory_unlock(hashtext($1)) AS unlocked`, [this.name]);
            if (rows[0]?.unlocked !== true) {
                warning(`Lock ${this.name} was not held by its connection when releasing it`);
            }
        } catch (e) {
            // Si no se pudo soltar, la conexion se destruye: al cerrarse, el servidor suelta el bloqueo.
            fallo = e instanceof Error ? e : new Error(String(e));
            throw e;
        } finally {
            Lock.giveBack(session.client, session.onError, fallo);
        }
    }

}
