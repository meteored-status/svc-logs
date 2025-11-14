import {Pool, PoolConfig, QueryResult} from "pg";
import {FSWatcher, watch} from "node:fs";
import {Transaction} from "./transaction";
import {arrayChop} from "../../utiles/array";
import {PromiseDelayed} from "../../utiles/promise";
import {readFileString, readJSON} from "../../utiles/fs";
import {error, info, warning} from "../../utiles/log";
import {Notify} from "./notify/notify";
import {Lock} from "./lock/lock";
import {md5} from "../../utiles/hash";

interface IPostgreSQLHost {
    host: string;
    port: number;
    ssl?: IPostgreSQLSSL;
}

interface IPostgreSQLCommon {
    user?: string;
    password?: string;
    database?: string;
}

export interface IPostgreSQL extends IPostgreSQLHost, IPostgreSQLCommon {
}

interface IPostgreSQLSSL {
    ca: string;
    cert: string;
    key: string;
}

interface IPostgreSQLCluster {
    primary?: IPostgreSQLHost;
    read?: IPostgreSQLHost;
    notify?: IPostgreSQLHost;
    common?: IPostgreSQLCommon;
}

export interface IPostgreSQLBuild {
    credenciales?: string;
    database?: string;
}

export type TipoRegistro = any;

interface IQueryOptionsBase {
}

interface IQueryOptions extends IQueryOptionsBase {
    transaction?: Transaction;
}

interface IBulkOptions extends IQueryOptions {
    size?: number;
    delay?: number;
}

interface ISelectOptions<T, S=T> extends IQueryOptions {
    fn?: (rows: T)=>S|Promise<S>;
    master?: boolean;
}

type TInstance = "primary" | "read" | "notify";

export interface IInsert {
    table: string;
    query: string;
    params: Array<any>;
    pk?: string[];
    duplicate?: string[];
}

export type TListener = (payload: any) => void;

class PostgreSQLCluster {
    /* STATIC */

    /* INSTANCE */
    private readonly instances: Partial<Record<TInstance, IPostgreSQLHost>> = {};
    private _notify: Notify|undefined;

    public constructor(private readonly database?: string) {
    }

    public add(instance: TInstance, host: IPostgreSQLHost): void {
        this.instances[instance] = host;
    }

    public async primary(): Promise<Pool> {
        const data = this.instances["primary"];
        if (!data) {
            return Promise.reject("No hay instancia primaria definida en el cluster de PostgreSQL");
        }
        return new Pool(await this.loadHost(data));
    }

    public async replica(): Promise<Pool> {
        const data = this.instances["read"];
        if (!data) {
            return this.primary();
        }
        return new Pool(await this.loadHost(data));
    }

    private async notify(): Promise<Pool> {
        const data = this.instances["notify"] ?? this.instances["primary"];
        if (!data) {
            return Promise.reject("No hay instancia de notificaciones definida en el cluster de PostgreSQL");
        }
        return new Pool(await this.loadHost(data));
    }

    private async loadHost(host: IPostgreSQLHost): Promise<PoolConfig> {
        const certs = host.ssl;

        const config: PoolConfig = {
            ...host,
            database: this.database,
        }

        if (certs) {
            const [ca, cert, key] = await Promise.all([
                readFileString(certs.ca),
                readFileString(certs.cert),
                readFileString(certs.key),
            ]);
            config.ssl = {
                ca,
                cert,
                key,
                rejectUnauthorized: false, // TODO
            };
        } else {
            if (PRODUCCION) {
                config.ssl = {
                    rejectUnauthorized: false,
                }
            }
        }
        return config;
    }

    public async end(): Promise<void> {
        for (const instance of Object.values(this.instances)) {
            const pool = new Pool(await this.loadHost(instance));
            await pool.end();
        }
    }

    public async notifyInstance(): Promise<Notify> {
        if (!this._notify) {
            this._notify = Notify.init(await this.notify());
        }
        return this._notify;
    }

    public async getLock(key: string): Promise<Lock|null> {
        return await Lock.acquire(key, await this.primary()).catch(() => null);
    }
}

export class PostgreSQL implements Disposable {
    /* STATIC */

    public static build({credenciales=`files/credenciales/postgresql.json`, database=DATABASE}: IPostgreSQLBuild = {}): PostgreSQL {
        if (database != undefined) {
            database = database
                .replaceAll("{CLIENTE}", process.env["CLIENTE"] ?? "")
            ;
        }

        return new this(credenciales, database);
    }

    /* INSTANCE */
    private _cluster?: Promise<PostgreSQLCluster>;
    private _primary?: Promise<Pool>;
    private _replica?: Promise<Pool>;

    private watcher?: FSWatcher;

    protected constructor(protected readonly credenciales: string, public readonly database?: string) {
    }

    public [Symbol.dispose](): void {
        this.stopWatcher();
        this.reset().then(()=>undefined).catch((err)=>error(err));
    }

    private get cluster(): Promise<PostgreSQLCluster> {
        return this._cluster??=this.open();
    }

    private get primary(): Promise<Pool> {
        return this._primary??=this.cluster.then(cluster => cluster.primary());
    }

    private get replica(): Promise<Pool> {
        return this._replica??=this.cluster.then(cluster => cluster.replica());
    }

    private get notify(): Promise<Notify> {
        return this.cluster.then(cluster => cluster.notifyInstance());
    }

    private lock(name: string): Promise<Lock|null> {
        return this.cluster.then(cluster => cluster.getLock(name));
    }

    private async open(): Promise<PostgreSQLCluster> {
        const data = await readJSON<IPostgreSQL|IPostgreSQLCluster>(this.credenciales);

        const cluster = new PostgreSQLCluster(this.database);

        if ("read" in data) {
            const common = data.common ?? {};

            if (data.primary) {
                cluster.add("primary", {
                    ...data.primary,
                    ...common,
                });
            }
            if (data.read) {
                cluster.add("read", {
                    ...data.read,
                    ...common,
                });
            }
            if (data.notify) {
                cluster.add("notify", {
                    ...data.notify,
                    ...common,
                });
            }
        } else {
            cluster.add("primary", data as IPostgreSQLHost);
            cluster.add("read", data as IPostgreSQLHost);
            cluster.add("notify", data as IPostgreSQLHost);
        }

        this.startWatcher();

        return cluster;
    }

    private async reset(): Promise<void> {
        if (this._cluster) {
            const cluster = this._cluster;

            this._cluster = undefined;
            this._primary = undefined;
            this._replica = undefined;

            const clusterInstance = await cluster;
            await clusterInstance.end();
        }
    }

    private startWatcher(): void {
        if (PRODUCCION && this.watcher===undefined && this.credenciales) {
            this.watcher = watch(this.credenciales, () => {
                info("Cambiando credenciales de PostgreSQL...");
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

    private async masterQuery(sql: string, params: TipoRegistro[]=[]): Promise<QueryResult> {
        const db = await this.primary;
        return await db.query(sql, params);
    }

    public async selectOne<T=any, S=T>(sql: string, params: TipoRegistro[]=[], options: ISelectOptions<T, S>={}): Promise<S> {
        const [row] = await this.select<T, S>(sql, params, options);

        return row ?? await Promise.reject(`No se encontró ningún registro para la consulta: ${sql} | PARAMS: [${params}]`);
    }

    public async select<T=any, S=T>(sql: string, params: TipoRegistro[]=[], {master, fn, transaction}: ISelectOptions<T, S>={}): Promise<S[]> {
        let registros: T[];

        const pool = !master ? this.replica : this.primary;
        const db = await pool;
        const {rows, rowCount} = transaction ? await transaction.query(sql, params) : await db.query(sql, params);
        registros = rows as T[];

        if (fn) {
            return await Promise.all(registros.map(fn));
        }

        return registros as never as S[];
    }

    public async insert(sql: string, params: TipoRegistro[]=[], {transaction}: IQueryOptions = {}): Promise<QueryResult> {
        if (transaction) {
            return transaction.insert(sql, params);
        }
        return this.masterQuery(sql, params);
    }

    public async update(sql: string, params: TipoRegistro[]=[], {transaction}: IQueryOptions = {}): Promise<QueryResult> {
        if (transaction) {
            return transaction.update(sql, params);
        }
        return this.masterQuery(sql, params);
    }

    public async delete(sql: string, params: TipoRegistro[]=[], {transaction}: IQueryOptions = {}): Promise<QueryResult> {
        if (transaction) {
            return transaction.delete(sql, params);
        }
        return this.masterQuery(sql, params);
    }

    public async transaction(): Promise<Transaction> {
        return new Transaction(await this.primary);
    }

    public async bulkInsert(records: IInsert[], {transaction, size, delay}: IBulkOptions = {}): Promise<void> {
        if (records.length>0) {
            const blockSize = size??0;
            const grupos = new Map<string, IInsert[]>();
            for (const actual of records) {
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
                    const [base, valuesTemplate] = key.split(/VALUES/i);

                    const valores = [
                        ...value.map(actual=> {
                            const args = valuesTemplate.match(/\$\d+/g);
                            let finalValue = valuesTemplate;
                            if (args) {
                                args.forEach(arg => {
                                    const index = parseInt(arg.replace("$", ""))-1;
                                    const argumentValue = actual.params[index];
                                    if (typeof argumentValue === "string") {
                                        finalValue = finalValue.replace(arg, `'${argumentValue}'`);
                                    } else {
                                        finalValue = finalValue.replace(arg, `${argumentValue}`);
                                    }
                                });
                            }
                            return finalValue;
                        }),
                    ];
                    let coletilla: string;
                    if (!value[0].duplicate || value[0].duplicate.length===0 || !value[0].pk || value[0].pk.length===0) {
                        coletilla = "";
                    } else {
                        coletilla = `on conflict (${value[0].pk.join(', ')}) do update set ${value[0].duplicate.map(actual=>`${actual}=EXCLUDED.${actual}`).join(", ")}`;
                    }

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

    public listen(channel: string, listener: TListener): void {
        this.notify.then(notify => {
            notify.listen(channel, result => {
                let payload: any;
                try {
                    payload = JSON.parse(result);
                } catch (err) {
                    payload = result;
                }
                const key = md5(`${channel}:${result}`);
                this.lock(key).then(result => {
                    if (result) {
                        listener(payload);
                        PromiseDelayed(5000).then(() => {
                            result.release().catch(err => {
                                warning(`Error releasing lock for channel ${channel}:`, err);
                            });
                        });
                    }
                });
            }).catch(err => {
                error(`Error setting up LISTEN on channel ${channel}:`, err);
            });
        });
    }

}
