import {ICliente} from "services-comun-status/modules/services/status-logs-slave/backend";
import {Storage} from "services-comun/modules/fs/storage";
import {Google} from "services-comun/modules/utiles/config";
import {info} from "services-comun/modules/utiles/log";
import db from "services-comun/modules/utiles/mysql";
import {PromiseDelayed} from "services-comun/modules/utiles/promise";

import {Cloudflare} from "./source/cloudflare";
import {Configuracion} from "../utiles/config";

interface IBucketMySQL {
    id: string;
    cliente: string;
    grupo: string|null;
}

export interface INotifyPubSub extends INotify {
    eventTime: string;
    eventType: string;
    notificationConfig: string;
    objectGeneration: string;
    payloadFormat: string;
}

export interface INotify {
    bucketId: string;
    objectId: string;
}

export class Bucket {
    /* STATIC */
    public static async runPubSub(config: Configuracion, notify: INotifyPubSub): Promise<void> {
        if (notify.eventType!="OBJECT_FINALIZE") {
            switch (notify.eventType) {
                case "OBJECT_DELETE":
                    // deshabilitado por filtro de PubSub
                    break;
                default:
                    info("Evento todavía no soportado", notify.eventType, JSON.stringify(notify));
                    break;
            }
            return;
        }

        await this.addProcesando(notify);

        const bucket = await this.findBucket(notify.bucketId);
        const cliente: ICliente = {
            id: bucket.cliente,
            grupo: bucket.grupo,
        };
        await this.update(notify, cliente);
        await this.procesando(notify);
        await bucket.ingest(config, notify, false)
            .then(()=>this.endProcesando(notify))
            .catch(err=>this.addRepesca(notify, cliente, err));
    }

    public static async run(config: Configuracion, notify: INotify, cliente?: ICliente): Promise<void> {
        let bucket: Bucket;
        if (cliente==undefined) {
            bucket = await this.findBucket(notify.bucketId);
            cliente = {
                id: bucket.cliente,
                grupo: bucket.grupo,
            }
            await this.update(notify, cliente);
        } else {
            bucket = new this({
                id: notify.bucketId,
                cliente: cliente.id,
                grupo: cliente.grupo ?? null,
            });
        }

        await this.repescando(notify);

        await bucket.ingest(config, notify, true)
            .then(()=>this.endProcesando(notify))
            .catch(err=>this.addRepesca(notify, cliente, err));
    }

    private static CACHE: NodeJS.Dict<Promise<Bucket>> = {};
    protected static async findBucket(bucket: string): Promise<Bucket> {
        return this.CACHE[bucket]??=this.findBucketEjecutar(bucket);
    }

    protected static async findBucketEjecutar(bucket: string): Promise<Bucket> {
        const [row] = await db.query<IBucketMySQL>("SELECT id, cliente, grupo FROM buckets WHERE id=?", [bucket])
        if (row==undefined) {
            return Promise.reject(`Bucket no registrado: ${bucket}`);
        }

        return new this(row);
    }

    public static buildSource(notify: INotify): string {
        return `gs://${notify.bucketId}/${notify.objectId}`;
    }

    public static async addProcesando(notify: INotify): Promise<void> {
        await db.insert("INSERT INTO procesando (bucket, archivo) VALUES (?, ?)", [notify.bucketId, notify.objectId]);
    }

    public static async update(notify: INotify, cliente: ICliente): Promise<void> {
        await db.insert("UPDATE procesando SET cliente=?, grupo=? WHERE bucket=? AND archivo=?", [cliente.id, cliente.grupo??null, notify.bucketId, notify.objectId]);
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

    public static async addRepesca(notify: INotify, cliente?: ICliente, err?: any): Promise<void> {
        const mensaje = err!=undefined?JSON.stringify(err):null;
        await db.insert("INSERT INTO repesca (bucket, archivo, cliente, grupo, mensaje) VALUES (?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE contador=contador+1, mensaje=?, tratando=0", [notify.bucketId, notify.objectId, cliente?.id??null, cliente?.grupo??null, mensaje, mensaje]);
        await db.insert("UPDATE procesando SET estado=? WHERE bucket=? AND archivo=?", ["error", notify.bucketId, notify.objectId]);
    }

    /* INSTANCE */
    public readonly id: string;
    public readonly cliente: string;
    public readonly grupo?: string;

    private constructor(data: IBucketMySQL) {
        this.id = data.id;
        this.cliente = data.cliente;
        this.grupo = data.grupo??undefined;
    }

    public getCliente(): ICliente {
        return {
            id: this.cliente,
            grupo: this.grupo,
        };
    }

    private async getArchivoErr(config: Google, bucket: string, file: string, retry: number, err: any): Promise<Storage|null> {
        if (err?.code == 404) {
            return null;
        }

        if (retry >= 10) {
            return Promise.reject(`Error obteniendo archivo: gs://${bucket}/${file} => ${JSON.stringify(err)}`);
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

    public async ingest(config: Configuracion, notify: INotify, repesca: boolean): Promise<void> {
        const data = await this.getArchivo(config.google, notify.bucketId, notify.objectId);
        if (data==null) {
            // info("Archivo no encontrado", Bucket.buildSource(notify));
            return;
        }

        const contenido = await data.toString().then(str=>str.trim());
        await Cloudflare.ingest(config, this.getCliente(), notify, repesca, contenido);

        await data.delete();
    }
}
