import {Google} from "services-comun/modules/utiles/config";
import {PromiseDelayed} from "services-comun/modules/utiles/promise";
import {Storage} from "services-comun/modules/fs/storage";
import db from "services-comun/modules/utiles/mysql";

import {Cloudflare} from "./source/cloudflare";

interface INotify {
    bucketId: string;
    objectId: string;
}

export interface IBucketMySQL {
    id: string;
    cliente: string;
}

export interface ICliente {
    id: string;
}

export class Bucket {
    /* STATIC */
    // private static readonly TIMEOUT = 60000;

    public static buildSource(notify: INotify): string {
        return `gs://${notify.bucketId}/${notify.objectId}`;
    }

    private static CACHE: NodeJS.Dict<Promise<Bucket>> = {};
    protected static async findBucket(bucket: string): Promise<Bucket> {
        return this.CACHE[bucket]??=this.findBucketEjecutar(bucket);
    }

    protected static async findBucketEjecutar(bucket: string): Promise<Bucket> {
        const [row] = await db.query<IBucketMySQL, Bucket>("SELECT id, cliente FROM buckets WHERE id=?", [bucket], {
            fn: (row)=>new this(row),
        });

        return row ?? await Promise.reject(new Error(`Bucket no registrado: ${bucket}`));
    }

    public static async addProcesando(notify: INotify): Promise<void> {
        await db.insert("INSERT INTO procesando (bucket, archivo) VALUES (?, ?) ON DUPLICATE KEY UPDATE estado=?", [notify.bucketId, notify.objectId, "recibido"]);
    }

    public static async update(notify: INotify, cliente: ICliente): Promise<void> {
        await db.insert("UPDATE procesando SET cliente=? WHERE bucket=? AND archivo=?", [cliente.id, notify.bucketId, notify.objectId]);
    }

    public static async procesando(notify: INotify): Promise<void> {
        await db.insert("UPDATE procesando SET estado=? WHERE bucket=? AND archivo=?", ["procesando", notify.bucketId, notify.objectId]);
    }

    public static async repescando(notify: INotify): Promise<void> {
        await db.insert("INSERT INTO procesando (bucket, archivo, estado) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE estado=?", [notify.bucketId, notify.objectId, "repescando", "repescando"]);
    }

    public static async endProcesando(notify: INotify): Promise<void> {
        await db.insert("DELETE FROM procesando WHERE bucket=? AND archivo=?", [notify.bucketId, notify.objectId]);
    }

    public static async addRepesca(notify: INotify, repesca: boolean, cliente?: ICliente, err?: any): Promise<void> {
        const mensaje = err!=undefined?JSON.stringify(err):null;
        const origen = !repesca?"ingest":"repesca";
        await db.insert("INSERT INTO repesca (bucket, archivo, cliente, mensaje, origen) VALUES (?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE contador=contador+1, mensaje=?, tratando=0, origen=?", [notify.bucketId, notify.objectId, cliente?.id??null, mensaje, origen, mensaje, origen]);
        await db.insert("UPDATE procesando SET estado=? WHERE bucket=? AND archivo=?", ["error", notify.bucketId, notify.objectId]);
    }

    /* INSTANCE */
    public readonly id: string;
    public readonly cliente: string;

    protected constructor(data: IBucketMySQL) {
        this.id = data.id;
        this.cliente = data.cliente;
    }

    public getCliente(): ICliente {
        return {
            id: this.cliente,
        };
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

    public async ingest(storage: Google, notify: INotify, signal: AbortSignal, repesca: boolean): Promise<void> {
        const data = await this.getArchivo(storage, notify.bucketId, notify.objectId);
        if (data==null) {
            // info("Archivo no encontrado", Bucket.buildSource(notify));
            return;
        }

        await Cloudflare.ingest(this.getCliente(), notify, data, signal, repesca);
        await db.delete("DELETE FROM repesca WHERE bucket=? AND archivo=?", [notify.bucketId, notify.objectId]);
        await data.delete();
    }
}
