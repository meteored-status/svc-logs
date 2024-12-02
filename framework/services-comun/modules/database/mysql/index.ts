import {
    createPoolCluster,
    escape,
    type ResultSetHeader,
    type Pool,
    type PoolCluster,
    type PreparedStatementInfo,
    type QueryOptions,
    type SslOptions,
} from "mysql2/promise";
import {FSWatcher, watch} from "node:fs";

import {PromiseDelayed} from "../../utiles/promise";
import {Transaction} from "./transaction";
import {arrayChop} from "../../utiles/array";
import {error, info, warning} from "../../utiles/log";
import {readFileString, readJSON} from "../../utiles/fs";

interface IMySQLHost {
    host: string;
    port: number;
}

interface IMySQLSocket {
    socketPath: string;
}

interface IMySQLCommon {
    user?: string;
    password?: string;
    database?: string;
    waitForConnections?: boolean;
    connectionLimit?: number;
    queueLimit?: number;
}

interface IMySQL extends IMySQLHost, IMySQLSocket, IMySQLCommon {
}

interface IMySQLSSL {
    ca: string;
    cert: string;
    key: string;
}

interface IMySQLCluster {
    master?: IMySQL;
    slaves: IMySQL[];
    common?: IMySQLCommon;
    ssl?: IMySQLSSL;
}

export type TipoRegistro = string|number|boolean|Date|null|undefined|string[]|number[]|boolean[]|Date[]|string[][]|number[][]|boolean[][]|Date[][];

interface IQueryOptionsBase {
    preparedCache?: boolean;
}

interface IQueryOptions extends IQueryOptionsBase {
    transaction?: Transaction;
}

interface ISelectOptions<T, S=T> extends IQueryOptions {
    fn?: (rows: T)=>S|Promise<S>;
    master?: boolean;
}

interface IBulkOptions extends IQueryOptions {
    size?: number;
    delay?: number;
}

export interface IInsert {
    table: string;
    query: string;
    params: Array<any>;
    duplicate?: string[];
}

export interface IUpdate extends IInsert {
    update: string;
}

export interface LoadDataInfileQueryOptions extends QueryOptions {
    // infileStreamFactory: () => NodeJS.ReadableStream;
}

interface IMySQLBuild {
    credenciales?: string;
    database?: string;
}

export class MySQL implements Disposable {
    /* STATIC */
    public static build({credenciales=`files/credenciales/mysql.json`, database=DATABASE}: IMySQLBuild={}): MySQL {
        using salida = new this(credenciales, database);

        return salida;
    }

    /* INSTANCE */
    private _cluster?: Promise<PoolCluster>;
    private get cluster(): Promise<PoolCluster> {
        return this._cluster ??= this.open();
    }

    private _master?: Promise<Pool>;
    private get master(): Promise<Pool> {
        return this._master ??= this.cluster.then(cluster=>cluster.of("MASTER") as Pool);
    }

    private _slave?: Promise<Pool>;
    private get slave(): Promise<Pool> {
        return this._slave ??= this.cluster.then(cluster=>cluster.of("SLAVE*") as Pool);
    }

    private watcher?: FSWatcher;
    private readonly queries: Record<string, Promise<PreparedStatementInfo>>;

    // LLAMAR AL CONSTRUCTOR DIRÉCTAMENTE QUEDA PROHIBIDO, USAR MySQL.build() EN SU LUGAR
    protected constructor(protected readonly credenciales: string, public readonly database?: string) {
        this.queries = {};
    }

    public [Symbol.dispose](): void {
        this.stopWatcher();
        this.reset().then(()=>{}).catch((err)=>error(err));
    }

    public async close(): Promise<void> {
        this.stopWatcher();
        await this.reset();
    }

    private async reset(): Promise<void> {
        if (this._cluster!=undefined) {
            const cluster = this._cluster;

            this._cluster = undefined;
            this._master = undefined;
            this._slave = undefined;

            const pool = await cluster;
            await pool.end();
        }
    }

    private async open(): Promise<PoolCluster> {
        const data = await readJSON<IMySQL|IMySQLCluster>(this.credenciales);

        const cluster = createPoolCluster({
            removeNodeErrorCount: 3600, // eliminar el nodo tras 1 hora de errores
            restoreNodeTimeout: 1000, // probar a reconectar tras 1 segundo
        });
        if ("slaves" in data) {
            let ssl: SslOptions|undefined;
            if (data.ssl!=undefined) {
                const [ca, cert, key] = await Promise.all([
                    readFileString(data.ssl.ca),
                    readFileString(data.ssl.cert),
                    readFileString(data.ssl.key),
                ]);
                ssl = {
                    ca,
                    cert,
                    key,
                    rejectUnauthorized: true,
                };
            } else {
                ssl = undefined;
            }

            data.common??={};

            if (data.master!=undefined) {
                cluster.add("MASTER", {
                    charset: "utf8mb4",
                    database: this.database,
                    ssl,
                    ...data.common,
                    ...data.master,
                });
            }
            for (let i = 0; i < data.slaves.length; i++) {
                cluster.add(`SLAVE${i}`, {
                    charset: "utf8mb4",
                    database: this.database,
                    ssl,
                    ...data.common,
                    ...data.slaves[i],
                });
            }
        } else {
            cluster.add("MASTER", {
                charset: "utf8mb4",
                database: this.database,
                ...data,
            });
            cluster.add("SLAVE1", {
                charset: "utf8mb4",
                database: this.database,
                ...data,
            });
        }
        // await this.checkConexion(pool);

        this.startWatcher();

        return cluster;
    }

    private startWatcher(): void {
        if (PRODUCCION && this.watcher==undefined && this.credenciales) {
            this.watcher = watch(this.credenciales, () => {
                info("Cambiando credenciales de MySQL");
                this.reset().then(()=>{}).catch((err)=>error(err));
            });
        }
    }

    private stopWatcher(): void {
        if (this.watcher!=undefined) {
            this.watcher.close();
            this.watcher = undefined;
        }
    }

    public escape(value: TipoRegistro): string {
        return escape(value);
    }

    public async query<T=any, S=T>(sql: string, params: TipoRegistro[]=[], {master=false, transaction, fn, preparedCache=true}: ISelectOptions<T, S>={}): Promise<S[]> {
        const select = sql.startsWith("SELECT") || sql.startsWith("select");
        if (!select) {
            error(`Consulta no select: ${sql} => use la función adecuada en lugar de db.query`)
        }
        let registros: T[];

        if (transaction) {
            registros = await transaction.query<T>(sql, params);
        } else {
            const pool = select && !master ? this.slave : this.master;
            const db = await pool;
            const [rows] = await db.query(sql, params);
            registros = rows as T[];
        }

        if (select && fn!=undefined) {
            return await Promise.all(registros.map(fn));
        }

        return registros as never as S[];
    }

    public async queryOne<T=any, S=T>(sql: string, params: TipoRegistro[]=[], options: ISelectOptions<T, S>={}): Promise<S> {
        const [row] = await this.query<T, S>(sql, params, options);

        return row ?? await Promise.reject(`No se encontró ningún registro`);
    }

    public async select<T=any, S=T>(sql: string, params: TipoRegistro[]=[], {master=false, transaction, fn, preparedCache=true}: ISelectOptions<T, S>={}): Promise<S[]> {
        let registros: T[];

        if (transaction) {
            registros = await transaction.query<T>(sql, params);
        } else {
            const pool = !master ? this.slave : this.master;
            const db = await pool;
            if (preparedCache) {
                const query = await (this.queries[sql] ??= db.prepare(sql));
                const [rows] = await query.execute(params)
                    .catch((err)=>{
                        delete this.queries[sql];
                        return Promise.reject(err);
                    });
                registros = rows as T[];
            } else {
                const [rows] = await db.query(sql, params);
                registros = rows as T[];
            }
        }

        if (fn!=undefined) {
            return await Promise.all(registros.map(fn));
        }

        return registros as never as S[];
    }

    public async load<T>(options: LoadDataInfileQueryOptions): Promise<T[]> {
        const db = await this.master;
        const [rows] = await db.query(options);

        return rows as T[];
    }

    private async masterQuery(sql: string, params: TipoRegistro[]=[], {preparedCache=true}: IQueryOptionsBase, retry: number = 0): Promise<ResultSetHeader> {
        const db = await this.master;
        try {
            if (preparedCache) {
                const query = await (this.queries[sql] ??= db.prepare(sql));
                const [rows] = await query.execute(params)
                    .catch((err)=>{
                        delete this.queries[sql];
                        return Promise.reject(err);
                    });

                return rows as ResultSetHeader;
            }

            const [rows] = await db.query<ResultSetHeader>(sql, params);

            return rows;
        } catch(err: any) {
            if (err.code=="ER_LOCK_DEADLOCK" && retry<10) {
                await PromiseDelayed(Math.floor(Math.random()*100) + retry*1000);

                return this.masterQuery(sql, params, {preparedCache}, retry+1);
            }

            warning(`DEADLOCK en consulta "${sql}" ${retry}`);
            return Promise.reject(err);
        }
    }

    public async insert(sql: string, params: TipoRegistro[]=[], {transaction, preparedCache}: IQueryOptions = {}): Promise<ResultSetHeader> {
        if (transaction) {
            return transaction.insert(sql, params);
        }
        return this.masterQuery(sql, params, {preparedCache});
    }

    public async update(sql: string, params: TipoRegistro[]=[], {transaction, preparedCache}: IQueryOptions = {}): Promise<ResultSetHeader> {
        if (transaction) {
            return transaction.update(sql, params);
        }
        return this.masterQuery(sql, params, {preparedCache});
    }

    public async delete(sql: string, params: TipoRegistro[]=[], {transaction, preparedCache}: IQueryOptions = {}): Promise<ResultSetHeader> {
        if (transaction) {
            return transaction.delete(sql, params);
        }
        return this.masterQuery(sql, params, {preparedCache});
    }

    public async truncate(table: string, {transaction, preparedCache}: IQueryOptions = {}): Promise<ResultSetHeader> {
        if (transaction) {
            return transaction.truncate(table);
        }
        return this.masterQuery(`TRUNCATE TABLE ${table};`, [], {preparedCache});
    }

    public async bulkInsert(registros: IInsert[], {transaction, preparedCache=true, size, delay}: IBulkOptions = {}): Promise<void> {
        if (registros.length>0) {
            const blockSize = size??0;
            const grupos = new Map<string, IInsert[]>();
            for (const actual of registros) {
                if (!grupos.has(actual.query)) {
                    grupos.set(actual.query, [actual]);
                } else {
                    const grupo = grupos.get(actual.query) as IInsert[];
                    grupo.push(actual);
                }
            }

            const inserts: string[] = [];
            grupos.forEach((value, key)=>{
                if (value.length>0) {
                    const valores = [
                        ...value.map(actual=>`(${[...actual.params.map(valor=>`${escape(valor)}`),].join(",")})`),
                    ];
                    let coletilla: string;
                    if (value[0].duplicate==undefined  || value[0].duplicate.length==0) {
                        coletilla = "";
                    } else {
                        coletilla = ` as new ON DUPLICATE KEY UPDATE ${value[0].duplicate.map(actual=>`${actual}=new.${actual}`).join(", ")}`
                    }

                    const base = key.split("VALUES")[0].split("values")[0];
                    for (const bloque of arrayChop(valores, Math.min(blockSize, valores.length))) {
                        inserts.push(`${base} VALUES ${bloque.join(",")} ${coletilla}`);
                    }
                }
            });

            for (const insert of inserts) {
                await this.insert(insert, [], {transaction, preparedCache}).catch(async (err) => {
                    warning(`ERROR Insertando registros`, err, insert as any);
                    if (transaction) {
                        return Promise.reject(err);
                    }
                });
                await PromiseDelayed(delay??0);
            }
        }
    }

    public async bulkUpdate(registros: IUpdate[], blockSize: number=0): Promise<void> {
        if (registros.length>0) {
            const grupos = new Map<string, IUpdate[]>();
            for (const actual of registros) {
                if (!grupos.has(actual.query)) {
                    grupos.set(actual.query, [actual]);
                } else {
                    const grupo = grupos.get(actual.query) as IUpdate[];
                    grupo.push(actual);
                }
            }

            const inserts: string[] = [];
            grupos.forEach((value, key)=>{
                if (value.length>0) {
                    const valores = [
                        ...value.map(actual=>`(${[...actual.params.map(valor=>`${escape(valor)}`),].join(",")})`),
                    ];

                    if (valores.length > 0) {
                        const base = key.split("VALUES")[0].split("values")[0];
                        for (const bloque of arrayChop(valores, Math.min(blockSize, valores.length))) {
                            inserts.push(`${base} VALUES ${bloque.join(",")} ON DUPLICATE KEY UPDATE ${value[0].update}`);
                        }
                    }
                }
            });

            for (const insert of inserts) {
                await this.insert(insert).catch(async (err) => {
                    warning(`ERROR Actualizando registros`, err, insert as any);
                });
            }
        }
    }

    public async transaction(): Promise<Transaction> {
        return new Transaction(await this.master);
    }
}
