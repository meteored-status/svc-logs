import type {IInsert} from "services-comun/modules/database/mysql";
import {Storage} from "services-comun/modules/fs/storage";
import {Google, IPodInfo} from "services-comun/modules/utiles/config";
import {error} from "services-comun/modules/utiles/log";
import db from "services-comun/modules/utiles/mysql";
import {PromiseDelayed} from "services-comun/modules/utiles/promise";
import {Cloudflare} from "../source/cloudflare";
import {Telemetry} from "../telemetry";
import {ClienteError} from "./error";
import {Grupo} from "./grupo";

import {type Cliente} from "./index";

export type BucketClienteGCS = Record<string, ClienteGCS>;

type TCSTipo = "cloudflare";

interface IClienteGCS {
    bucket: string;
    tipo: TCSTipo;
}

interface IClienteGCSMySQL extends IClienteGCS {
    cliente: string;
    grupo?: string;
}

export class ClienteGCS implements IClienteGCS {
    /* STATIC */
    public static async searchBucket(bucket: string): Promise<ClienteGCS> {
        const [cliente] = await db.select<IClienteGCSMySQL, ClienteGCS>(`SELECT * FROM gcs WHERE bucket=?`, [bucket], {
            fn: async (raw)=>new this(await Grupo.searchID(raw.cliente, raw.grupo), raw),
        });
        if (cliente==undefined) {
            return Promise.reject(new ClienteError(`GCS ${bucket} no encontrado`));
        }

        return cliente;
    }

    public static async searchAll(): Promise<BucketClienteGCS> {
        const clientes = await db.select<IClienteGCSMySQL, ClienteGCS>(`SELECT * FROM gcs`, [], {
            fn: async (raw)=>new this(await Grupo.searchID(raw.cliente, raw.grupo), raw),
        });

        const salida: BucketClienteGCS = {};
        for (const cliente of clientes) {
            salida[cliente.bucket] = cliente;
        }

        return salida;
    }

    public static async addStatusProcesando(bucket: string, source: string): Promise<void> {
        await db.insert("INSERT INTO procesando (bucket, archivo) VALUES (?, ?) ON DUPLICATE KEY UPDATE estado=?", [bucket, source, "recibido"]);
    }

    private static PRIMERO = true;

    /* INSTANCE */
    public readonly bucket: string;
    public readonly tipo: TCSTipo;

    private constructor(public readonly cliente: Cliente, data: IClienteGCS) {
        this.bucket = data.bucket;
        this.tipo = data.tipo;

        this.enableCliente();
    }

    private enableCliente(): ClienteGCS {
        this.cliente.aplicarGCS(this);

        return this;
    }

    public async addStatusProcesando(source: string): Promise<void> {
        await db.update("UPDATE procesando SET estado=? WHERE bucket=? AND archivo=?", ["procesando", this.bucket, source]);
    }

    public async addStatusRepescando(source: string): Promise<void> {
        await db.insert("INSERT INTO procesando (bucket, archivo, estado) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE estado=?", [this.bucket, source, "repescando", "repescando"]);
    }

    public async addStatusTerminado(source: string): Promise<void> {
        await db.delete("DELETE FROM procesando WHERE bucket=? AND archivo=?", [this.bucket, source]);
    }

    public async addStatusError(source: string): Promise<void> {
        await db.delete("DELETE FROM procesando WHERE bucket=? AND archivo=?", [this.bucket, source]);
    }

    public async addStatusRepesca(source: string, repesca: boolean, err?: any): Promise<void> {
        if (ClienteGCS.PRIMERO) {
            ClienteGCS.PRIMERO = false;
            error(err);
        }

        let mensaje: string|null;
        if (err!=undefined) {
            if (err instanceof Error) {
                mensaje = err.message;
            } else {
                mensaje = JSON.stringify(err);
            }
        } else {
            mensaje = null;
        }
        const origen = !repesca?"ingest":"repesca";

        await db.insert("INSERT INTO repesca (bucket, archivo, mensaje, origen) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE contador=contador+1, mensaje=?, origen=?", [this.bucket, source, mensaje, origen, mensaje, origen]);
    }

    public async pescarHuerfanos(google: Google, fechas: string[]): Promise<void> {
        const bloques = await Promise.all(fechas.map(fecha=>Storage.list(google, this.bucket, fecha)));
        const files: IInsert[] = bloques.flat().map(file=>{
            const data = file.name.split("/")
                .at(-1)!
                .split("_")
                .at(0)!
                .replace(/(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z/, "$1-$2-$3T$4:$5:$6Z"); // esto incluye la fecha
            const fecha = new Date(data);
            return {
                table: "repesca",
                query: "INSERT INTO repesca (bucket, archivo, origen, fecha) VALUES (?, ?, ?, ?)",
                params: [this.bucket, file.name, "huerfano", fecha],
                duplicate: ["bucket", "archivo"],
            };
        });
        await db.bulkInsert(files);
        // todo esto se usa?
        // await db.update("UPDATE repesca, procesando SET repesca.tratando=1 WHERE repesca.bucket=procesando.bucket AND repesca.archivo=procesando.archivo");
    }

    private async getArchivoErr(config: Google, bucket: string, file: string, retry: number, err: any): Promise<Storage|null> {
        if (err?.code == 404) {
            return null;
        }

        if (retry >= 10) {
            return Promise.reject(new Error(`Error obteniendo archivo: gs://${bucket}/${file} => ${JSON.stringify(err)}`));
        }

        retry++;
        await PromiseDelayed(1000 * retry);
        return this.getArchivo(config, bucket, file, retry);
    }

    private async getArchivo(config: Google, bucket: string, file: string, retry: number = 0): Promise<Storage|null> {
        try {
            return Storage.getOne(config, bucket, file)
                .catch(async (err) => this.getArchivoErr(config, bucket, file, retry, err));
        } catch (err) {
            return this.getArchivoErr(config, bucket, file, retry, err);
        }
    }

    public async ingest(pod: IPodInfo, storage: Google, source: string, idx?: number): Promise<void> {
        // await this.addStatusUpdate(source);
        await this.addStatusProcesando(source);

        const data = await this.getArchivo(storage, this.bucket, source);
        if (data==null) {
            return;
        }

        const telemetry = Telemetry.build(this.cliente, pod, source);
        await Cloudflare.ingest(telemetry, data, idx);
        await db.delete("DELETE FROM repesca WHERE bucket=? AND archivo=?", [this.bucket, source]);
        await data.delete();
        await telemetry.toElastic();
    }
}
