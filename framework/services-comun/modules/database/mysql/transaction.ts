import {type PoolConnection, type ResultSetHeader, type Pool, type PoolNamespace} from "mysql2/promise";

import {type MySQL, type TipoRegistro} from "./";
import {error, info, warning} from "../../utiles/log";
import {md5} from "../../utiles/hash";
import {random} from "../../utiles/random";

export enum TIsolationLevel {
    REPEATABLE_READ     = 1,
    READ_COMMITTED      = 2,
    READ_UNCOMMITTED    = 3,
    SERIALIZABLE        = 4,
}

export class Transaction {
    /* STATIC */
    private static readonly ISOLATION_LEVEL_MAP: Map<TIsolationLevel, string> = new Map([
        [TIsolationLevel.REPEATABLE_READ, "REPEATABLE READ"],
        [TIsolationLevel.READ_COMMITTED, "READ COMMITTED"],
        [TIsolationLevel.READ_UNCOMMITTED, "READ UNCOMMITTED"],
        [TIsolationLevel.SERIALIZABLE, "SERIALIZABLE"]
    ]);

    private static isolationLevel(level: TIsolationLevel): string {
        return this.ISOLATION_LEVEL_MAP.get(level) ?? "READ_COMMITTED";
    }

    /* INSTANCE */
    private _connection?: Promise<PoolConnection>;
    private get connection(): Promise<PoolConnection> {
        return this._connection ??= this.pool.getConnection();
    }

    public readonly hash: string;

    public constructor(private readonly pool: Pool | PoolNamespace) {
        const hash = md5(`${random(32)}-${Date.now()}-${random(32)}`);
        this.hash = `${hash.substring(0, 3)}${hash.substring(29)}`;
    }

    // public get hash(): string {
    //     return this._hash;
    // }

    /**
     * Inicia una nueva transacción.
     * @param level Nivel de aislamiento de la transacción.
     * @param name Nombre personalizado de la transacción.
     */
    public async start(level: TIsolationLevel = TIsolationLevel.READ_COMMITTED, name: string = ''): Promise<Transaction> {
        const connection = await this.connection;
        await connection.execute(`set transaction isolation level ${Transaction.isolationLevel(level)}`);
        await connection.beginTransaction();
        if (!PRODUCCION) info(`Transaction ${this.hash} => BEGIN${name ? `: ${name}` : ``}`);

        return this;
    }

    private async executeQuery<T>(sql: string, params: any[]=[]): Promise<T[]> {
        if (!PRODUCCION) info(`Transaction ${this.hash} => QUERY: ${sql} | PARAMS: [${params}]`);
        const connection = await this.connection;
        const [rows] = await connection.query(sql, params);
        return rows as T[];
    }

    public async query<T>(sql: string, params: any[]=[]): Promise<T[]> {
        return await this.executeQuery(sql, params);
    }

    private async execute(sql: string, params: TipoRegistro[]=[]): Promise<ResultSetHeader> {
        const connection = await this.connection;
        const [rows] = await connection.query<ResultSetHeader>(sql, params);
        return rows;
    }

    public async insert(sql: string, params: TipoRegistro[]=[]): Promise<ResultSetHeader> {
        if (!PRODUCCION) info(`Transaction ${this.hash} => INSERT: ${sql} | PARAMS: [${params}]`);
        return await this.execute(sql, params);
    }

    public async update(sql: string, params: TipoRegistro[]=[]): Promise<ResultSetHeader> {
        if (!PRODUCCION) info(`Transaction ${this.hash} => UPDATE: ${sql} | PARAMS: [${params}]`);
        return await this.execute(sql, params);
    }

    public async delete(sql: string, params: TipoRegistro[]=[]): Promise<ResultSetHeader> {
        if (!PRODUCCION) info(`Transaction ${this.hash} => DELETE: ${sql} | PARAMS: [${params}]`);
        return await this.execute(sql, params);
    }

    public async truncate(table: string): Promise<ResultSetHeader> {
        if (!PRODUCCION) info(`Transaction ${this.hash} => TRUNCATE: ${table}`);
        return await this.execute(`TRUNCATE TABLE ${table}`);
    }

    /**
     * Confirma los cambios de la transacción.
     */
    public async commit(): Promise<void> {
        const connection = await this.connection;
        await connection.commit();
        if (!PRODUCCION) info(`Transaction ${this.hash} => COMMIT`);
        await this.release();
    }

    /**
     * Deshace los cambios realizados por la transacción antes de que los confirme.
     */
    public async rollback(): Promise<void> {
        const connection = await this.connection;
        await connection.rollback();
        if (!PRODUCCION) warning(`Transaction ${this.hash} => ROLLBACK`);
        await this.release();
    }

    /**
     * Libera la conexión.
     * @private
     */
    private async release(): Promise<void> {
        const connection = await this.connection;
        connection.release();
    }

    public async lastInsertId(): Promise<number> {
        return this.query<{id: number}>("SELECT LAST_INSERT_ID() AS id").then(rows => rows[0].id);
    }
}

export function transactional(db: MySQL, name: string = '', level: TIsolationLevel = TIsolationLevel.READ_COMMITTED): Function {
    return (originalMethod: any) => {

        return function (this: any, ...args: any[]) {
            return Promise.resolve().then(async ()=>{
                let t = args.find(arg => arg instanceof Transaction);
                const initial = t === undefined;
                if (!t) {
                    t = await db.transaction();
                    await t.start(level, name);
                } else {
                    if (!PRODUCCION) info(`Transaction ${t.hash} => JOIN${name ? `: ${name}` : ``}`);
                }
                let salida;
                try {
                    salida = await originalMethod.apply(this, [...args, t]);
                    if (initial) {
                        await t.commit();
                    }
                } catch (e) {
                    if (initial) {
                        error(`Transaction ${t.hash} failed: `, e);
                        await t.rollback();
                        salida = Promise.reject(e);
                    } else {
                        throw e;
                    }
                }
                return salida;
            });
        };
    };
}

// type TDecoratorBuilder = (target: any, propertyKey: string, descriptor: PropertyDescriptor)=>void;
// export function transactional(name: string = '', level: TIsolationLevel = TIsolationLevel.READ_COMMITTED): TDecoratorBuilder {
//     return (target: any, propertyKey: string, descriptor: PropertyDescriptor): void => {
//
//         const original = Symbol(propertyKey);
//         target[original] = descriptor.value;
//
//         descriptor.value = async function (...args: any[]) {
//             const t: Transaction = await db.transaction();
//             if (!PRODUCCION) info(`Transaction ${t.hash} => BEGIN${name ? `: ${name}` : ``}`);
//             await t.start(level);
//             let salida;
//             try {
//                 salida = await target[original].apply(this, [...args, t]);
//                 await t.commit();
//                 if (!PRODUCCION) info(`Transaction ${t.hash} => COMMIT`);
//             } catch (e) {
//                 error(`Transaction ${t.hash} failed: `, e);
//                 await t.rollback();
//                 if (!PRODUCCION) warning(`Transaction ${t.hash} => ROLLBACK`);
//                 salida = Promise.reject(e);
//             }
//             return salida;
//         }
//     };
// }
