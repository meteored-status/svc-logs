import {SlaveLogsBackendRequest} from "services-comun-status/modules/services/status-logs-slave/backend";
import {PromiseDelayed} from "services-comun/modules/utiles/promise";
import {error, info} from "services-comun/modules/utiles/log";
import db from "services-comun/modules/utiles/mysql";

export interface IRepesca {
    bucket: string;
    archivo: string;
    cliente?: string;
    grupo?: string;
}

interface IRepescaMySQL {
    bucket: string;
    archivo: string;
    cliente: string|null;
    grupo: string|null;
    // mensaje: string|null;
    // contador: number;
    // fecha: Date;
}

export class Repesca {
    /* STATIC */
    public static async run(): Promise<void> {
        await Promise.all([
            this.repescarPendientes(),
            this.repescarBloqueados(),
        ]);
    }

    protected static async repescarPendientes(): Promise<void> {
        const registros = await this.getPendientes();
        if (registros.length==0) {
            return;
        }

        await this.repescar(registros);
        await this.repescarPendientes();
    }

    protected static async repescarBloqueados(): Promise<void> {
        const registros = await this.getBloqueados();
        if (registros.length==0) {
            return;
        }

        await this.repescar(registros);
        await this.repescarBloqueados();
    }

    protected static async repescar(registros: Repesca[]): Promise<void> {
        const promesas: Promise<void>[] = [];
        for (const registro of registros) {
            info("Ingestando", registro.cliente??"-", registro.grupo??"-", registro.bucket, registro.archivo);
            promesas.push(registro.ingest().catch(err=>error(err)));
            await PromiseDelayed(100);
        }
        await Promise.all(promesas);
        // for (const registro of registros) {
        //     info("Ingestando", registro.cliente??"-", registro.grupo??"-", registro.bucket, registro.archivo);
        //     await registro.ingest()
        //         .catch((err)=>{
        //             error(err);
        //         });
        // }
    }

    protected static async getPendientes(): Promise<Repesca[]> {
        return db.select<IRepescaMySQL, Repesca>("SELECT bucket, archivo, cliente, grupo FROM repesca WHERE tratando=0 ORDER BY fecha LIMIT 0,1", [], {
            fn: (row)=>new Repesca({
                bucket: row.bucket,
                archivo: row.archivo,
                cliente: row.cliente??undefined,
                grupo: row.grupo??undefined,
            }),
        });
    }

    protected static async getBloqueados(): Promise<Repesca[]> {
        return db.select<IRepescaMySQL, Repesca>("SELECT bucket, archivo, cliente, grupo FROM procesando WHERE fecha<? ORDER BY fecha LIMIT 0,10", [new Date(Date.now()-10800000)], {
            fn: (row)=>new Repesca({
                bucket: row.bucket,
                archivo: row.archivo,
                cliente: row.cliente??undefined,
                grupo: row.grupo??undefined,
            }),
        });
    }

    /* INSTANCE */
    public get bucket(): string { return this.data.bucket; }
    public get archivo(): string { return this.data.archivo; }
    public get cliente(): string|undefined { return this.data.cliente; }
    public get grupo(): string|undefined { return this.data.grupo; }

    private constructor(protected data: IRepesca) {
    }

    public async ingest(): Promise<void> {
        await this.tratar();
        try {

            await SlaveLogsBackendRequest.ingest(this.bucket, this.archivo, this.cliente, this.grupo);
            await this.delete();

        } catch (err) {
            if (err instanceof Error) {
                if  (err.message == "Service Unavailable") {
                    return;
                }
                console.log(err.message);
            } else {
                console.log(err);
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
