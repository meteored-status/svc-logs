import {
    createPoolCluster,
    escape,
    type PoolCluster,
    type PoolNamespace,
    type PoolOptions,
    type PreparedStatementInfo,
    type QueryOptions,
    type ResultSetHeader,
    type SslOptions,
} from "mysql2/promise";
import {FSWatcher, watch} from "node:fs";

import type {ICacheConfig} from "./cache";
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
    ssl?: IMySQLSSL;
}

export interface IMySQL extends IMySQLHost, IMySQLSocket, IMySQLCommon {
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
}

interface IQueryOptions extends IQueryOptionsBase {
    transaction?: Transaction;
}

export interface ISelectOptions<T, S=T> extends IQueryOptions {
    fn?: (rows: T)=>S|Promise<S>;
    master?: boolean;
    cache?: ICacheConfig;
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
    public static build({credenciales=`files/credenciales/mysql.json`, database}: IMySQLBuild={}): MySQL {
        database ??= (process.env["DATABASE"] ?? DATABASE);
        if (database != undefined) {
            database = database
                .replaceAll("{CLIENTE}", process.env["CLIENTE"] ?? "")
            ;
        }
        using salida = new this(credenciales, database);

        return salida;
    }

    /* INSTANCE */
    private _cluster?: Promise<PoolCluster>;
    private get cluster(): Promise<PoolCluster> {
        return this._cluster ??= this.open();
    }

    private _master?: Promise<PoolNamespace>;
    private get master(): Promise<PoolNamespace> {
        return this._master ??= this.cluster.then(cluster=>cluster.of("MASTER"));
    }

    private _slave?: Promise<PoolNamespace>;
    private get slave(): Promise<PoolNamespace> {
        return this._slave ??= this.cluster.then(cluster=>cluster.of("SLAVE*"));
    }

    private watcher?: FSWatcher;
    private readonly queries: Record<string, Promise<PreparedStatementInfo>>;

    // LLAMAR AL CONSTRUCTOR DIRÉCTAMENTE QUEDA PROHIBIDO, USAR MySQL.build() EN SU LUGAR
    protected constructor(protected readonly credenciales: string, public readonly database?: string) {
        this.queries = {};
    }

    public [Symbol.dispose](): void {
        this.stopWatcher();
        this.reset().then(()=>undefined).catch((err)=>error(err));
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
            const common = data.common ?? {};

            if (data.master!==undefined) {
                cluster.add("MASTER", await this.loadHost(data.master, common, data.ssl));
            }
            for (let i = 0; i < data.slaves.length; i++) {
                cluster.add(`SLAVE${i}`, await this.loadHost(data.slaves[i], common, data.ssl));
            }
        } else {
            cluster.add("MASTER", await this.loadHost(data, {}));
            cluster.add("SLAVE1", await this.loadHost(data, {}));
        }
        // await this.checkConexion(pool);

        this.startWatcher();

        return cluster;
    }

    private async loadHost(host: IMySQL, common: IMySQLCommon, tls?: IMySQLSSL): Promise<PoolOptions> {
        const certs = host.ssl ?? common.ssl ?? tls;
        let ssl: SslOptions|undefined;
        if (certs!==undefined) {
            if (host.ssl!==undefined) {
                delete host.ssl;
            }
            try {
                const [ca, cert, key] = await Promise.all([
                    readFileString(certs.ca),
                    readFileString(certs.cert),
                    readFileString(certs.key),
                ]);
                ssl = {
                    ca,
                    cert,
                    key,
                    rejectUnauthorized: true,
                };
            } catch (err) {
                warning("Error cargando certificados", err instanceof Error ? err.message : err);
                ssl = undefined;
            }
        } else {
            ssl = undefined;
        }
        return {
            charset: "utf8mb4",
            database: this.database,
            ...common,
            ...host,
            ssl,
        }
    }

    private startWatcher(): void {
        if (PRODUCCION && this.watcher===undefined && this.credenciales) {
            this.watcher = watch(this.credenciales, () => {
                info("Cambiando credenciales de MySQL");
                this.reset().then(()=>undefined).catch((err)=>error(err));
            });
        }
    }

    private stopWatcher(): void {
        if (this.watcher!==undefined) {
            this.watcher.close();
            this.watcher = undefined;
        }
    }

    public escape(value: TipoRegistro): string {
        return escape(value);
    }

    /**
     * @deprecated Use the `select` method instead.
     */
    public async query<T=any, S=T>(sql: string, params: TipoRegistro[]=[], {master=false, transaction, fn}: ISelectOptions<T, S>={}): Promise<S[]> {
        error(`##### DB.query está deprecado, use DB.select en su lugar`);
        const select = sql.startsWith("SELECT") || sql.startsWith("select");
        if (!select) {
            error(`Consulta no select: ${sql} => use la función adecuada en lugar de db.query`);
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

    /**
     * @deprecated Use the `selectOne` method instead.
     */
    public async queryOne<T=any, S=T>(sql: string, params: TipoRegistro[]=[], options: ISelectOptions<T, S>={}): Promise<S> {
        error(`##### DB.queryOne está deprecado, use DB.selectOne en su lugar`);
        return this.selectOne<T, S>(sql, params, options);
    }

    public async selectOne<T=any, S=T>(sql: string, params: TipoRegistro[]=[], options: ISelectOptions<T, S>={}): Promise<S> {
        const [row] = await this.select<T, S>(sql, params, options);

        return row ?? await Promise.reject(`No se encontró ningún registro`);
    }

    public async select<T=any, S=T>(sql: string, params: TipoRegistro[]=[], {master=false, transaction, fn, cache}: ISelectOptions<T, S>={}): Promise<S[]> {
        let registros: T[];

        if (transaction) {
            registros = await transaction.query<T>(sql, params);
        } else {
            if (cache==undefined) {
                const pool = !master ? this.slave : this.master;
                const db = await pool;
                const [rows] = await db.query(sql, params);
                registros = rows as T[];
            } else {
                const builder = await cache.builder.get<T>(sql);
                registros = await builder.get(sql, params, async (sql, params)=>{
                    const pool = !master ? this.slave : this.master;
                    const db = await pool;
                    const [rows] = await db.query(sql, params);
                    return rows as T[];
                }, cache);
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

    private async masterQuery(sql: string, params: TipoRegistro[]=[], options: IQueryOptionsBase = {}, retry: number = 0): Promise<ResultSetHeader> {
        const db = await this.master;
        try {
            const [rows] = await db.query<ResultSetHeader>(sql, params);

            return rows;
        } catch(err: any) {
            if (err.code==="ER_LOCK_DEADLOCK" && retry<10) {
                await PromiseDelayed(Math.floor(Math.random()*100) + retry*1000);

                return this.masterQuery(sql, params, options, retry+1);
            }

            warning(`DEADLOCK en consulta "${sql}" ${retry}`);
            return Promise.reject(err);
        }
    }

    public async insert(sql: string, params: TipoRegistro[]=[], {transaction}: IQueryOptions = {}): Promise<ResultSetHeader> {
        if (transaction) {
            return transaction.insert(sql, params);
        }
        return this.masterQuery(sql, params);
    }

    public async update(sql: string, params: TipoRegistro[]=[], {transaction}: IQueryOptions = {}): Promise<ResultSetHeader> {
        if (transaction) {
            return transaction.update(sql, params);
        }
        return this.masterQuery(sql, params);
    }

    public async delete(sql: string, params: TipoRegistro[]=[], {transaction}: IQueryOptions = {}): Promise<ResultSetHeader> {
        if (transaction) {
            return transaction.delete(sql, params);
        }
        return this.masterQuery(sql, params);
    }

    public async truncate(table: string, {transaction}: IQueryOptions = {}): Promise<ResultSetHeader> {
        if (transaction) {
            return transaction.truncate(table);
        }
        return this.masterQuery(`TRUNCATE TABLE ${table};`);
    }

    public async bulkInsert(registros: IInsert[], {transaction, size, delay}: IBulkOptions = {}): Promise<void> {
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
                    if (value[0].duplicate===undefined  || value[0].duplicate.length===0) {
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
                await this.insert(insert, [], {transaction}).catch(async (err) => {
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
                    warning(`ERROR Actualizando registros`, err, insert);
                });
            }
        }
    }

    public async transaction(): Promise<Transaction> {
        return new Transaction(await this.master);
    }
}
