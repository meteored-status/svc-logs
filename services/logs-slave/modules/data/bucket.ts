import {Bucket as BucketBase, type IBucketMySQL, type ICliente} from "logs-base/modules/data/bucket";
import {Google, IPodInfo} from "services-comun/modules/utiles/config";
import {type INotify} from "services-comun-status/modules/services/logs-slave/backend";
import {PromiseTimeout, PromiseTimeoutError} from "services-comun/modules/utiles/promise";
import {info} from "services-comun/modules/utiles/log";
import db from "services-comun/modules/utiles/mysql";

import {Cloudflare} from "./source/cloudflare";
import {type Configuracion} from "../utiles/config";

export interface INotifyPubSub extends INotify {
    eventTime: string;
    eventType: string;
    notificationConfig: string;
    objectGeneration: string;
    payloadFormat: string;
}

export class Bucket extends BucketBase {
    /* STATIC */
    private static readonly TIMEOUT = 300000;

    public static async run(config: Configuracion, notify: INotifyPubSub): Promise<void> {
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
        await bucket.ingest(config.pod, config.google, notify)
            .then(()=>this.endProcesando(notify))
            .catch(err=>this.addRepesca(notify, cliente, err));
    }

    private static CACHE: NodeJS.Dict<Promise<Bucket>> = {};
    protected static async findBucket(bucket: string): Promise<Bucket> {
        return this.CACHE[bucket]??=this.findBucketEjecutar(bucket);
    }

    protected static async findBucketEjecutar(bucket: string): Promise<Bucket> {
        const [row] = await db.query<IBucketMySQL, Bucket>("SELECT id, cliente, grupo FROM buckets WHERE id=?", [bucket], {
            fn: (row)=>new this(row),
        });

        return row ?? await Promise.reject(`Bucket no registrado: ${bucket}`);
    }

    public async ingest(pod: IPodInfo, storage: Google, notify: INotify): Promise<void> {
        const data = await this.getArchivo(storage, notify.bucketId, notify.objectId);
        if (data==null) {
            // info("Archivo no encontrado", Bucket.buildSource(notify));
            return;
        }

        await PromiseTimeout(Cloudflare.ingest(pod, this.getCliente(), notify, data).then(async ()=>{
            await db.update("UPDATE problemas SET end=? WHERE bucket=? AND archivo=?", [new Date(), notify.bucketId, notify.objectId]);
            await db.delete("DELETE FROM repesca WHERE bucket=? AND archivo=?", [notify.bucketId, notify.objectId]);
            await data.delete();
        }), Bucket.TIMEOUT)
            .catch(async (err)=>{
                if (err instanceof PromiseTimeoutError) {
                    await db.insert("INSERT IGNORE INTO problemas (bucket, archivo, cliente, grupo, detalle) VALUES (?, ?, ?, ?, ?)", [notify.bucketId, notify.objectId, this.cliente, this.grupo??null, "TimeoutError parseando el log"]);
                    return;
                }
                return Promise.reject(err);
            });

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
}
