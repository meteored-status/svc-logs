/**
 * Editor: Bixus
 * Fecha: Wed, 23 Sep 2026 08:46:26 GMT
 * Hash: a74ac4d9fcabaac373e5f285d30ae8ca
 * Versión: 2026.9.23+3-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

import type {Pool, PoolClient, QueryResult} from "pg";

import { IsolationLevel } from "../transaction/isolation";
import {Transaction as TransactionBase} from "../transaction/transaction";
import type {TipoRegistro} from "./";
import {info} from "../../utiles/log";

export enum TIsolationLevel {
    READ_COMMITTED      = 1,
    REPEATABLE_READ     = 2,
    SERIALIZABLE        = 3,
}

export class Transaction extends TransactionBase {
    /* STATIC */
    private static readonly ISOLATION_LEVEL_MAP: Map<TIsolationLevel, string> = new Map([
        [TIsolationLevel.REPEATABLE_READ, "REPEATABLE READ"],
        [TIsolationLevel.READ_COMMITTED, "READ COMMITTED"],
        [TIsolationLevel.SERIALIZABLE, "SERIALIZABLE"]
    ]);

    private static isolationLevel(level: TIsolationLevel): string {
        return this.ISOLATION_LEVEL_MAP.get(level) ?? "READ_COMMITTED";
    }

    /* INSTANCE */
    private readonly connection: Promise<PoolClient>;
    public constructor(private readonly pool: Pool) {
        super();
        this.connection = pool.connect();
    }

    public override async begin(isolationLevel?: IsolationLevel): Promise<void> {
        const connection = await this.connection;
        await connection.query('BEGIN');
        if (isolationLevel) {
            let level: TIsolationLevel|undefined = undefined;
            switch (isolationLevel) {
                case IsolationLevel.SERIALIZABLE:
                    level = TIsolationLevel.SERIALIZABLE;
                    break;
            }
            if (level) {
                await connection.query(`SET TRANSACTION ISOLATION LEVEL ${Transaction.isolationLevel(level)}`);
            }
        }
    }

    public override async commit(): Promise<void> {
        const connection = await this.connection;
        await connection.query('COMMIT');
        await this.release();
    }

    public override async rollback(): Promise<void> {
        const connection = await this.connection;
        await connection.query('ROLLBACK');
        await this.release();
    }

    private async executeQuery<T>(sql: string, params: TipoRegistro[]=[]): Promise<QueryResult> {
        if (!PRODUCCION) {info(`Transaction ${this.hash} => QUERY: ${sql} | PARAMS: [${params}]`);}
        const connection = await this.connection;
        return await connection.query(sql, params);
    }

    public async query<T>(sql: string, params: any[]=[]): Promise<QueryResult> {
        return await this.executeQuery(sql, params);
    }

    private async execute(sql: string, params: TipoRegistro[]=[]): Promise<QueryResult> {
        const connection = await this.connection;
        return await connection.query(sql, params);
    }

    public async insert(sql: string, params: TipoRegistro[]=[]): Promise<QueryResult> {
        if (!PRODUCCION) {info(`Transaction ${this.hash} => INSERT: ${sql} | PARAMS: [${params}]`);}
        return this.execute(sql, params);
    }

    public async update(sql: string, params: TipoRegistro[]=[]): Promise<QueryResult> {
        if (!PRODUCCION) {info(`Transaction ${this.hash} => UPDATE: ${sql} | PARAMS: [${params}]`);}
        return this.execute(sql, params);
    }

    public async delete(sql: string, params: TipoRegistro[]=[]): Promise<QueryResult> {
        if (!PRODUCCION) {info(`Transaction ${this.hash} => DELETE: ${sql} | PARAMS: [${params}]`);}
        return this.execute(sql, params);
    }

    /**
     * Libera la conexión.
     * @private
     */
    private async release(): Promise<void> {
        const connection = await this.connection;
        connection.release();
    }

}
