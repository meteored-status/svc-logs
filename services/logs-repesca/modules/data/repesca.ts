import {Fecha} from "services-comun/modules/utiles/fecha";
import {PromiseDelayed} from "services-comun/modules/utiles/promise";
import {TAbort} from "services-comun/modules/engine_base";
import {error, info} from "services-comun/modules/utiles/log";
import bulk from "services-comun/modules/utiles/elastic/bulk";
import db from "services-comun/modules/utiles/mysql";

import {Bucket} from "./bucket";
import {Configuracion} from "../utiles/config";

export interface IRepesca {
    bucket: string;
    archivo: string;
    cliente?: string;
    grupo?: string;
    backends?: Record<string, string>;
}

interface IRepescaMySQL {
    bucket: string;
    archivo: string;
    cliente: string|null;
    grupo: string|null;
    backends: Record<string, string>|null;
    // mensaje: string|null;
    // contador: number;
    // fecha: Date;
}

export class Repesca {
    /* STATIC */
    private static PARAR = false;

    public static async run(config: Configuracion, signal: AbortSignal, abort: TAbort): Promise<void> {
        let timeout: NodeJS.Timeout|undefined = setTimeout(()=>{
            info("Solicitando parada");
            this.PARAR = true;
            abort("Parada solicitada");
            timeout = undefined;
        }, 3300000); // 55 minutos para parar el proceso para evitar que se quede a medias cuando se borre el POD

        await this.reset();
        await this.liberarBloqueados();
        await this.liberarHuerfanos(config);
        await this.repescarPendientes(config, signal);

        if (timeout!=undefined) {
            clearTimeout(timeout);
        } else {
            info("Solicitando parada => OK");
        }

        await bulk.wait();
    }

    private static async reset(): Promise<void> {
        await db.update("UPDATE repesca SET tratando=0 WHERE tratando=1");
    }

    protected static async liberarBloqueados(): Promise<void> {
        await db.insert("INSERT IGNORE INTO repesca (bucket, archivo, cliente, grupo, backends, fecha) SELECT bucket, archivo, cliente, grupo, backends, fecha FROM procesando WHERE fecha<?", [new Date(Date.now()-10800000)]);
        await db.delete("DELETE FROM procesando WHERE (bucket, archivo) IN (SELECT bucket, archivo FROM repesca)");
    }

    private static async liberarHuerfanos(config: Configuracion): Promise<void> {
        const fechas: string[] = [];
        const hoy = new Date();
        if (hoy.getUTCHours()<4) {
            hoy.setUTCDate(hoy.getUTCDate()-1);
        }
        for (let i=1; i<7; i++) {
            hoy.setUTCDate(hoy.getUTCDate()-1);
            fechas.unshift(Fecha.generarFechaBloque(hoy));
        }
        for (const bucket of await Bucket.searchBuckets()) {
            await bucket.pescarHuerfanos(config.google, fechas);
        }
    }

    protected static async repescarPendientes(config: Configuracion, signal: AbortSignal): Promise<void> {
        let registros: Repesca[] = [];
        do {
            registros = await this.getPendientes();
            await this.repescar(config, registros, signal);
        } while (registros.length>0 && !this.PARAR);
    }

    protected static async repescar(config: Configuracion, registros: Repesca[], signal: AbortSignal): Promise<void> {
        const promesas: Promise<void>[] = [];
        for (const registro of registros) {
            if (registro.cliente!=undefined) {
                if (registro.grupo!=undefined) {
                    info(`Repescando [${registro.cliente}: ${registro.grupo}]`, registro.bucket, registro.archivo);
                } else {
                    info(`Repescando [${registro.cliente}]`, registro.bucket, registro.archivo);
                }
            } else {
                info(`Repescando []`, registro.bucket, registro.archivo);
            }
            promesas.push(registro.ingest(config, signal).catch(err=>error(err)));
            await PromiseDelayed(1000);
            // await registro.ingest(config, signal).catch(err=>error(err));
        }
        await Promise.all(promesas);
    }

    protected static async getPendientes(): Promise<Repesca[]> {
        return db.select<IRepescaMySQL, Repesca>("SELECT bucket, archivo, cliente, grupo, backends FROM repesca WHERE tratando=0 ORDER BY fecha LIMIT 5", [], {
            master: true,
            fn: (row)=>new Repesca({
                bucket: row.bucket,
                archivo: row.archivo,
                cliente: row.cliente??undefined,
                grupo: row.grupo??undefined,
                backends: row.backends??undefined,
            }),
        });
    }

    /* INSTANCE */
    public get bucket(): string { return this.data.bucket; }
    public get archivo(): string { return this.data.archivo; }
    public get cliente(): string|undefined { return this.data.cliente; }
    public get grupo(): string|undefined { return this.data.grupo; }
    public get backends(): Record<string, string>|undefined { return this.data.backends; }

    private constructor(protected data: IRepesca) {
    }

    public async ingest(config: Configuracion, signal: AbortSignal): Promise<void> {
        await this.tratar();
        try {

            // if (Math.random()<0.5) {
            //     await SlaveLogsBackendRequest.ingest(this.bucket, this.archivo);
            // } else {
                await Bucket.run(config, signal, {
                    bucketId: this.bucket,
                    objectId: this.archivo,
                }, this.cliente != undefined ? {
                    id: this.cliente,
                    grupo: this.grupo,
                    backends: this.backends ?? {},
                } : undefined);
            // }
            await this.delete();

        } catch (err) {

            if (err instanceof Error) {
                error(err.message);
            } else {
                error(err);
            }

        }
    }

    private async tratar(): Promise<void> {
        await db.update("UPDATE repesca SET tratando=1 WHERE bucket = ? AND archivo = ?", [this.bucket, this.archivo]);
    }

    private async delete(): Promise<void> {
        await db.delete("DELETE FROM repesca WHERE bucket = ? AND archivo = ?", [this.bucket, this.archivo]);
    }
}
