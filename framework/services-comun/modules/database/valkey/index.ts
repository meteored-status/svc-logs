/**
 * Editor: José Antonio Jiménez
 * Fecha: Wed, 17 Jun 2026 11:12:28 GMT
 * Hash: 8246f79083f591b0e272225ef1edeed0
 * Versión: 2026.6.17+3-josantoniojimnez
 */

import {GlideClient, GlideClusterClient, Logger, TimeUnit} from "@valkey/valkey-glide";
import process from "node:process";

import type {IPodInfo} from "@mr/core-workload/config/pod";

import {PromiseTimeout} from "../../utiles/promise";
import {readJSON} from "../../utiles/fs";
import {info, warning} from "../../utiles/log";

interface IValKeyBuild {
    pod: IPodInfo;
    credenciales?: string;
    options?: IValkeyOptions;
}

type IValKeyHost = {
    host: string
    port: number;
}

export type IValkeyOptions = {
    timeout?: number;
    clientTimeout?: number;
}

type QueryOptions = {
    shared?: boolean;
}

type SaveOptions = QueryOptions & {
    ttl?: number; // milliseconds
}

type Client = GlideClusterClient|GlideClient;

export class ValKey {
    /* STATIC */
    private static readonly MAX_CONNECT_MS: number = 500;
    private static readonly MAX_GET_MS: number = 10;

    private static CLIENTE?: ValKey;

    public static build({pod, credenciales = 'files/credenciales/valkey.json', options}: IValKeyBuild): ValKey {
        if (!this.CLIENTE) {
            Logger.setLoggerConfig("error");
            this.CLIENTE = new this(credenciales, pod, options);
            // Pre-calentar la conexión a través del getter (que cachea correctamente)
            void this.CLIENTE.cliente;
        }

        return this.CLIENTE;
    }

    /* INSTANCE */
    private errorTime: number;

    private _cliente?: Promise<Client|undefined>;
    protected get cliente(): Promise<Client|undefined> {
        if (!this._cliente) {
            this._cliente = this.initCliente();
        }
        return this._cliente;
    }

    private constructor(
        protected readonly credenciales: string,
        protected readonly pod: IPodInfo,
        private readonly options: IValkeyOptions = {}
    ) {
        this.errorTime = 0;
    }

    private async initCliente(): Promise<Client|undefined> {
        const connectTimeout = this.options.clientTimeout ?? ValKey.MAX_CONNECT_MS;

        try {
            const cliente = await PromiseTimeout(
                GlideClusterClient.createClient({
                    addresses: await readJSON<IValKeyHost[]>(this.credenciales),
                    requestTimeout: this.options.timeout ?? ValKey.MAX_GET_MS,
                    periodicChecks: {
                        duration_in_sec: 30,
                    },
                }),
                connectTimeout,
            );

            info("Conexión establecida con ValKey");
            return cliente;
        } catch (e) {
            if (e instanceof Error) {
                warning("Error conectando con ValKey", e.message);
            }
            // Resetear para permitir reintentos en la siguiente operación
            this._cliente = undefined;
            return undefined;
        }
    }

    // public [Symbol.dispose](): void {
    //     this.cliente.close();
    //     info(`Desconectado de ValKey.`);
    // }

    private invalidarCliente(): void {
        this._cliente = undefined;
    }

    public async get(key: string, {shared=false}: QueryOptions = {}): Promise<Buffer|null> {
        try {
            const cliente = await this.cliente;
            if (!cliente) {
                return null;
            }
            const data = await PromiseTimeout(cliente.get(this.buildKey(key, shared)), this.options.timeout ?? ValKey.MAX_GET_MS);
            this.errorTime = 0;
            if (data) {
                if (Buffer.isBuffer(data)) {
                    return data;
                }
                return Buffer.from(data as string, 'utf-8');
            }
        } catch (e) {
            const time = Date.now();
            // solo mostramos 1 error por minuto en caso de caída del servicio
            if (time-this.errorTime>60000) {
                if (e instanceof Error) {
                    warning(`Error obteniendo ${key} en ValKey`, e.message);
                } else {
                    warning(`Error obteniendo ${key} en ValKey`, JSON.stringify(e));
                }
                this.errorTime = time;
            }
            // Invalidar cliente para reconectar en la siguiente operación
            this.invalidarCliente();
        }
        return null;
    }

    public async set(key: string, data: Buffer, {shared=false, ttl}: SaveOptions = {}): Promise<void> {
        try {
            const cliente = await this.cliente;
            if (!cliente) {
                return;
            }
            await cliente.set(this.buildKey(key, shared), data, {expiry: { type: TimeUnit.Milliseconds, count: ttl ?? 2592000000 }});
            this.errorTime = 0;
        } catch (e) {
            const time = Date.now();
            // solo mostramos 1 error por minuto en caso de caída del servicio
            if (time-this.errorTime>60000) {
                if (e instanceof Error) {
                    warning(`Error guardando ${key} en ValKey`, e.message);
                } else {
                    warning(`Error guardando ${key} en ValKey`, JSON.stringify(e));
                }
                this.errorTime = time;
            }
            // Invalidar cliente para reconectar en la siguiente operación
            this.invalidarCliente();
        }
    }

    public async loadJSON<T>(key: string, {shared}: QueryOptions = {}): Promise<T|null> {
        const data = await this.get(key, {shared});

        if (data) {
            return JSON.parse(data.toString('utf-8')) as T;
        }
        return null;
    }

    public async saveJSON<T>(key: string, data: T, {shared, ttl}: SaveOptions = {}): Promise<void> {
        await this.set(key, Buffer.from(JSON.stringify(data), 'utf-8'), {shared, ttl});
    }

    private buildKey(key: string, shared: boolean) {
        if (shared) {
            return key;
        }
        const namespace = (process.env['K8S_NAMESPACE']??'default').replace('meteored','mr');
        return `${namespace}:${this.pod.servicio}:${key}`;
    }
}
