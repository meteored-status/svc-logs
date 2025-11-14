import {debug, warning} from "../../../utiles/log";
import {Pool} from "pg";

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
