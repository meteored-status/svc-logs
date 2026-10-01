/**
 * Editor: Bixus
 * Fecha: Wed, 23 Sep 2026 08:46:26 GMT
 * Hash: 37917fed3b75cef7372ee179d0881732
 * Versión: 2026.9.23+3-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

import type {Pool} from "pg";

import {debug, warning} from "../../../utiles/log";

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

    /* INSTANCE */
    private constructor(private readonly name: string, private readonly pool: Pool) {
    }

    public async release(): Promise<void> {
        debug(`Releasing lock: ${this.name}`);
        // Liberar el lock
        await this.pool.query(`SELECT pg_advisory_unlock(hashtext($1))`, [this.name]);
    }

}
