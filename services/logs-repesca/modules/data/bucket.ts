import {Bucket as BucketBase, type ICliente} from "logs-base/modules/data/bucket";
import {Cloudflare} from "logs-base/modules/data/source/cloudflare";
import type {INotify} from "services-comun-status/modules/services/logs-slave/backend";
import {type IInsert} from "services-comun/modules/database/mysql";
import {Storage} from "services-comun/modules/fs/storage";
import {Google} from "services-comun/modules/utiles/config";
import {error, info} from "services-comun/modules/utiles/log";
import db from "services-comun/modules/utiles/mysql";

import type {Configuracion} from "../utiles/config";

export class Bucket extends BucketBase {
    /* STATIC */
    public static async run(config: Configuracion, notify: INotify, cliente?: ICliente): Promise<void> {
        let bucket: Bucket;
        if (cliente==undefined) {
            bucket = await this.findBucket(notify.bucketId) as Bucket;
            cliente = {
                id: bucket.cliente,
                grupo: bucket.grupo,
                backends: bucket.backends,
            }
            await this.update(notify, cliente);
        } else {
            bucket = new this({
                id: notify.bucketId,
                cliente: cliente.id,
                grupo: cliente.grupo ?? null,
                backends: cliente.backends,
            });
        }

        await this.repescando(notify);

        const idx = await Cloudflare.getIDX(cliente, notify.objectId);
        if (idx!=undefined) {
            info(`Saltamos ${idx+1} registros ya indexados de ${cliente.id} ${cliente.grupo??"-"} ${notify.objectId}`);
        }

        try {
            await bucket.ingest(config.pod, config.google, notify, idx)
            await this.endProcesando(notify)
                .catch((err)=>{
                    error("Error en fin de proceso", err);
                });
        } catch (err) {
            await this.addRepesca(notify, true, cliente, err)
                .catch((err)=>{
                    error("Error en add de repesca", err);
                });
        }
    }

    public static async searchBuckets(): Promise<Bucket[]> {
        return await db.query(`SELECT id, cliente, grupo, backends FROM buckets`, [], {
            fn: (row)=>new this(row),
        });
    }

    /* INSTANCE */
    public async pescarHuerfanos(google: Google, fechas: string[]) {
        const bloques = await Promise.all(fechas.map(fecha=>Storage.list(google, this.id, fecha)));
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
                params: [this.id, file.name, "huerfano", fecha],
                duplicate: ["bucket", "archivo"],
            };
        });
        await db.bulkInsert(files);
        await db.update("UPDATE repesca, procesando SET repesca.tratando=1 WHERE repesca.bucket=procesando.bucket AND repesca.archivo=procesando.archivo");
    }
}
