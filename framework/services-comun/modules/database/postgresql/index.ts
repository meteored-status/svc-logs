/**
 * Editor: Juan C. Martínez
 * Fecha: Tue, 17 Nov 2026 09:24:35 GMT
 * Hash: 0bc40058f4f00bde14c3fdba1437d06c
 * Versión: 2026.11.17+1-juancmartinez
 * Anterior: 2026.10.6+1-juancmartinez
 * Proyecto: git@github.com:alpred/meteored-svc-localizacion.git
 */

import type {PoolConfig, QueryResult} from "pg";
import {Pool} from "pg";
import type {FSWatcher} from "node:fs";
import {watch} from "node:fs";

import {startupOptions} from "./startup-options";
import {Transaction} from "./transaction";
import {arrayChop} from "../../utiles/array";
import {PromiseDelayed} from "../../utiles/promise";
import {readFileString, readJSON} from "../../utiles/fs";
import {error, info, warning} from "../../utiles/log";
import {errorType, LogThrottle} from "../../utiles/log-throttle";
import {Notify} from "./notify/notify";
import {Lock} from "./lock/lock";
import {md5} from "../../utiles/hash";

/**
 * Opciones de las conexiones de un `PostgreSQL`/`AlloyDB`, encima de las credenciales.
 *
 * @property max                     - Conexiones como mucho en cada pool.
 * @property idleTimeoutMillis       - Cuanto aguanta abierta una conexion sin usar.
 * @property connectionTimeoutMillis - Cuanto se espera a conseguir una conexion.
 * @property applicationName         - `application_name` de cada conexion (lo que se ve en `pg_stat_activity`): sirve para reconocer de quien es una sesion, por ejemplo la que tiene un
 *   bloqueo. Es un parametro de arranque normal del protocolo (no un `-c` de `settings`), asi que lo admite tambien un PgBouncer.
 * @property settings                - Parametros de sesion de PostgreSQL que se fijan en CADA conexion al abrirla (`work_mem`,
 *   `statement_timeout`, el umbral de una extension como `pg_trgm.similarity_threshold`...). Viajan como opciones de arranque
 *   (`-c nombre=valor`), asi que valen tambien fuera de una transaccion y no se quedan pegados en una conexion que use otro: el
 *   pool es de quien los pidio. Para consultas que necesiten ajustes distintos, se construye otro `PostgreSQL`/`AlloyDB` con los
 *   suyos (cada uno tiene sus pools).
 */
export interface IPostgreSQLConnectionOptions {
    max?: number;
    idleTimeoutMillis?: number;
    connectionTimeoutMillis?: number;
    applicationName?: string;
    settings?: Record<string, string|number>;
}

interface IPostgreSQLCommon extends IPostgreSQLConnectionOptions {
    user?: string;
    password?: string;
    database?: string;
}

interface IPostgreSQLHost extends IPostgreSQLCommon {
    host: string;
    port: number;
    ssl?: IPostgreSQLSSL;
}

interface IPostgreSQLSocket {
    socketPath: string;
}

export interface IPostgreSQL extends IPostgreSQLHost, IPostgreSQLSocket, IPostgreSQLCommon {
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
    options?: IPostgreSQLConnectionOptions;
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
    params: any[];
    pk?: string[];
    duplicate?: string[];
}

export type TListener = (payload: any) => void;

class PostgreSQLCluster {
    /* INSTANCE */
    private readonly instances: Partial<Record<TInstance, IPostgreSQLHost>>;
    private _notify: Notify|undefined;
    private _lockPool: Promise<Pool>|undefined;
    private readonly poolErrors: LogThrottle;

    public constructor(private readonly database?: string) {
        this.instances = {};
        this.poolErrors = new LogThrottle();
    }

    public add(instance: TInstance, host: IPostgreSQLHost): void {
        this.instances[instance] = host;
    }

    public async primary(): Promise<Pool> {
        const data = this.instances["primary"];
        if (!data) {
            return Promise.reject("No hay instancia primaria definida en el cluster de PostgreSQL");
        }
        return this.watchPool(new Pool(await this.loadHost(data)), "primary");
    }

    public async replica(): Promise<Pool> {
        const data = this.instances["read"];
        if (!data) {
            return this.primary();
        }
        return this.watchPool(new Pool(await this.loadHost(data)), "read");
    }

    private async notify(): Promise<Pool> {
        const data = this.instances["notify"] ?? this.instances["primary"];
        if (!data) {
            return Promise.reject("No hay instancia de notificaciones definida en el cluster de PostgreSQL");
        }
        return this.watchPool(new Pool(await this.loadHost(data)), "notify");
    }

    /**
     * Engancha al pool el escuchador de `error`. `pg` emite ese evento cuando el servidor cierra una conexion INACTIVA del pool (reinicio, failover o mantenimiento
     * de la base, o un intermediario que corta las inactivas); sin escuchador, Node lo trata como no capturado y TUMBA EL PROCESO. Con el, `pg` descarta esa conexion y
     * abre otra cuando haga falta. Se registra como mucho un aviso por rol y tipo de error cada minuto (`LogThrottle`): una caida de la base cierra todas a la vez.
     */
    private watchPool(pool: Pool, role: TInstance): Pool {
        pool.on("error", err => {
            const callados = this.poolErrors.allow(`${role}:${errorType(err)}`, Date.now());
            if (callados !== null) {
                warning(`Error en una conexion inactiva del pool "${role}" de PostgreSQL${callados > 0 ? ` (${callados} mas callados desde el anterior)` : ""}`, err);
            }
        });
        return pool;
    }

    /**
     * El pool para los bloqueos de SESION (`tryLock`): el de la instancia `notify`, que es la conexion DIRECTA a la base (la primaria queda detras de un PgBouncer en modo transaccion, donde
     * un bloqueo de sesion no vale: cada consulta puede caer en otra conexion del servidor). En el formato plano de credenciales `notify` es la propia instancia. En el formato de cluster
     * sin entrada `notify` NO se cae a la primaria: se rechaza, porque tomar el bloqueo ahi parecería funcionar y no protegeria nada.
     */
    public lockPool(): Promise<Pool> {
        const pool = this._lockPool??=this.openLockPool();
        // Un fallo al abrirlo (certificados ilegibles...) no se queda cacheado: el siguiente intento lo reintenta.
        pool.catch(() => {
            if (this._lockPool === pool) {
                this._lockPool = undefined;
            }
        });
        return pool;
    }

    private async openLockPool(): Promise<Pool> {
        const data = this.instances["notify"];
        if (!data) {
            return Promise.reject(new Error("Los bloqueos de sesion necesitan una conexion directa: las credenciales de PostgreSQL en formato cluster deben llevar la entrada \"notify\" (la primaria va por PgBouncer)"));
        }
        // `keepAlive`: la conexion del bloqueo se queda SIN trafico mientras dura el trabajo, y un intermediario que cierre las conexiones inactivas la mataria (y con ella, el bloqueo).
        const pool = new Pool({...await this.loadHost(data), keepAlive: true});
        // Un error de una conexion INACTIVA del pool (se reinicia el servidor) sin escuchador tumbaria el proceso.
        pool.on("error", err => {
            warning("Error en una conexion inactiva del pool de bloqueos de PostgreSQL", err);
        });
        return pool;
    }

    private async loadHost({settings, applicationName, ...host}: IPostgreSQLHost): Promise<PoolConfig> {
        const certs = host.ssl;

        const config: PoolConfig = {
            ...host,
            database: this.database,
        }
        if (applicationName !== undefined) {
            config.application_name = applicationName;
        }
        if (settings !== undefined && Object.keys(settings).length > 0) {
            config.options = startupOptions(settings);
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
                rejectUnauthorized: false, // TODO,
            };
        } else {
            const hostIsSocketPath = host.host.includes("/") || host.host.includes("\\");
            info(`Cargando host de PostgreSQL: ${host.host} (socket: ${hostIsSocketPath})`);
            if (PRODUCCION && !hostIsSocketPath) {
                config.ssl = {
                    rejectUnauthorized: false,
                }
            }
        }
        return config;
    }

    public async end(): Promise<void> {
        const lockPool = this._lockPool;
        if (lockPool !== undefined) {
            this._lockPool = undefined;
            // Sin esperar: `Pool.end()` no termina hasta que se devuelven las conexiones prestadas, y un bloqueo en curso las tiene.
            void lockPool.then(pool => pool.end()).catch(err => {
                warning("Error cerrando el pool de bloqueos de PostgreSQL", err);
            });
        }
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

    public async tryLock(key: string): Promise<Lock|null> {
        return Lock.tryAcquire(key, await this.lockPool());
    }
}

export class PostgreSQL implements AsyncDisposable {
    /* STATIC */

    public static build({credenciales=`files/credenciales/postgresql.json`, database=DATABASE, options}: IPostgreSQLBuild = {}): PostgreSQL {
        if (database != undefined) {
            database = database
                .replaceAll("{CLIENTE}", process.env["CLIENTE"] ?? "")
            ;
        }

        return new this(credenciales, database, options);
    }

    /* INSTANCE */
    private _cluster?: Promise<PostgreSQLCluster>;
    private _primary?: Promise<Pool>;
    private _replica?: Promise<Pool>;

    private watcher?: FSWatcher;

    protected constructor(protected readonly credenciales: string, public readonly database?: string, private readonly options?: IPostgreSQLConnectionOptions) {
    }

    public async [Symbol.asyncDispose](): Promise<void> {
        this.stopWatcher();
        await this.reset().catch(async err =>error(err));
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

    /**
     * Intenta tomar, SIN esperar, un bloqueo consultivo de sesion (`pg_try_advisory_lock(hashtext(key))`) con la clave dada. Sirve para que una sola ejecucion de algo (un cronjob, una
     * exportacion) corra a la vez entre procesos distintos.
     *
     * - Va por una conexion DIRECTA (la entrada `notify` de las credenciales; en el formato plano, la propia instancia), NO por el pooler. Con credenciales de cluster sin `notify` rechaza.
     * - Esa conexion se queda reservada hasta `release()`, que lo suelta en ella misma. Hay que llamarlo siempre (`try`/`finally`).
     * - Si la conexion se cae, el servidor suelta el bloqueo y otra ejecucion puede tomarlo: se avisa en el log, pero quien lo tenia no se entera hasta que use la base.
     *
     * @returns El bloqueo, o `null` si otra sesion lo tiene. Rechaza si no se pudo conectar.
     */
    public async tryLock(key: string): Promise<Lock|null> {
        return (await this.cluster).tryLock(key);
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
                    ...this.options,
                });
            }
            if (data.read) {
                cluster.add("read", {
                    ...data.read,
                    ...common,
                    ...this.options,
                });
            }
            if (data.notify) {
                cluster.add("notify", {
                    ...data.notify,
                    ...common,
                    ...this.options,
                });
            }
        } else {
            cluster.add("primary", {
                ...data,
                ...this.options,
            } as IPostgreSQLHost);
            cluster.add("read", {
                ...data,
                ...this.options,
            } as IPostgreSQLHost);
            cluster.add("notify", {
                ...data,
                ...this.options,
            } as IPostgreSQLHost);
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
