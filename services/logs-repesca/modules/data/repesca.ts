import {type BucketClienteGCS, ClienteGCS} from "logs-base/modules/data/cliente/gcs";
import {Cloudflare} from "logs-base/modules/data/source/cloudflare";
import {Fecha} from "services-comun/modules/utiles/fecha";
import {PromiseDelayed} from "services-comun/modules/utiles/promise";
import {error, info} from "services-comun/modules/utiles/log";
import db from "services-comun/modules/utiles/mysql";

import {Configuracion} from "../utiles/config";

export interface IRepesca {
    bucket: string;
    archivo: string;
}

interface IRepescaMySQL {
    bucket: string;
    archivo: string;
}

export class Repesca {
    /* STATIC */
    private static PARALELOS = 5;
    private static PARAR = false;
    private static TIMEOUT?: NodeJS.Timeout;

    public static async run(config: Configuracion): Promise<void> {
        this.initTimer();

        await this.reset();
        await this.liberarBloqueados();
        const buckets = await this.liberarHuerfanos(config);

        await Promise.all(Array.from({ length: this.PARALELOS }, (_, i) => this.repescarPendientes(buckets, config, i)));

        this.endTimer();
    }

    private static initTimer(): void {
        const pendiente = new Date().setUTCMinutes(55,0,0)-Date.now();
        if (pendiente<=0) {
            info("No hay tiempo para una nueva ejecución");
            this.PARAR = true;
            return;
        }
        this.TIMEOUT = setTimeout(()=>{
            info("Solicitando parada");
            this.PARAR = true;
            this.TIMEOUT = undefined;
        }, pendiente); // paramos en el minuto 55 de la hora actual
    }

    private static endTimer(): void {
        if (this.TIMEOUT!=undefined) {
            clearTimeout(this.TIMEOUT);
            this.TIMEOUT = undefined;
        } else {
            info("Solicitando parada => OK");
        }
    }

    private static async reset(): Promise<void> {
        await db.update("UPDATE repesca SET i=NULL WHERE i IS NOT NULL");
    }

    protected static async liberarBloqueados(): Promise<void> {
        await db.insert("INSERT IGNORE INTO repesca (bucket, archivo, fecha) SELECT bucket, archivo, fecha FROM procesando WHERE fecha<?", [new Date(Date.now()-900000)]);
        await db.delete("DELETE FROM procesando WHERE (bucket, archivo) IN (SELECT bucket, archivo FROM repesca)");
    }

    private static async liberarHuerfanos(config: Configuracion): Promise<BucketClienteGCS> {
        const fechas: string[] = [];
        const hoy = new Date();
        if (hoy.getUTCHours()<4) {
            hoy.setUTCDate(hoy.getUTCDate()-1);
        }
        for (let i=1; i<7; i++) {
            hoy.setUTCDate(hoy.getUTCDate()-1);
            fechas.unshift(Fecha.generarFechaBloque(hoy));
        }
        const buckets = await ClienteGCS.searchAll();
        for (const bucket of Object.values(buckets)) {
            await bucket.pescarHuerfanos(config.google, fechas);
        }

        return buckets;
    }

    public static FECHA: string = "";

    protected static async repescarPendientes(buckets: BucketClienteGCS, config: Configuracion, i: number): Promise<void> {
        if (this.PARAR) {
            return;
        }

        const resultado = await db.update("UPDATE repesca SET i=? WHERE i IS NULL ORDER BY fecha LIMIT 1", [i]);
        if (resultado.affectedRows==0) {
            return;
        }

        let registro: Repesca|undefined;
        do {
            [registro] = await db.select<IRepescaMySQL, Repesca>("SELECT bucket, archivo FROM repesca WHERE i=? LIMIT 1", [i], {
                master: true,
                fn: (row) => new Repesca({
                    bucket: row.bucket,
                    archivo: row.archivo,
                }, buckets[row.bucket]),
            });
            if (registro==undefined) {
                await PromiseDelayed(Math.floor(Math.random()*1000));
            }
        } while (registro==undefined && !this.PARAR);

        if (this.PARAR) {
            return;
        }

        await this.repescar(config, registro);

        return this.repescarPendientes(buckets, config, i);
    }

    protected static async repescar(config: Configuracion, registro: Repesca): Promise<void> {
        const actual = registro.archivo.split("/").at(-1)!.split("_").at(0)!.replace(/(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z/, "$1-$2-$3T$4:$5:$6Z");
        if (this.FECHA<actual) {
            this.FECHA = actual;
            info(`Repescando ${this.FECHA}`);
        }
        try {
            await registro.ingest(config).catch(err => error(err));
        } catch (err) {
            if (err instanceof Error) {
                error(err.message);
            } else {
                error(err);
            }
        }
    }

    /* INSTANCE */
    public get bucket(): string { return this.data.bucket; }
    public get archivo(): string { return this.data.archivo; }

    private constructor(protected data: IRepesca, private gcs: ClienteGCS) {
    }

    private async addStatusTerminado(): Promise<void> {
        await db.delete("DELETE FROM repesca WHERE bucket = ? AND archivo = ?", [this.bucket, this.archivo]);
    }

    public async ingest(config: Configuracion): Promise<void> {
        await this.gcs.addStatusRepescando(this.archivo);

        const idx = await Cloudflare.getIDX(this.gcs.cliente, this.archivo);
        if (idx!=undefined) {
            info(`Saltamos ${idx+1} registros ya indexados de ${this.gcs.cliente.id} ${this.gcs.cliente.grupo??"-"} ${this.archivo}`);
        }

        try {
            await this.gcs.ingest(config.pod, config.google, this.archivo, idx)
            await this.gcs.addStatusTerminado(this.archivo);
            await this.addStatusTerminado();
        } catch (err) {
            await this.gcs.addStatusRepesca(this.archivo, true, err);
            await this.gcs.addStatusError(this.archivo);
        }
    }
}
