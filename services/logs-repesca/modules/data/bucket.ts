import {Bucket as BucketBase, ICliente} from "logs-base/modules/data/bucket";
import {INotify} from "services-comun-status/modules/services/logs-slave/backend";
import {type IInsert} from "services-comun/modules/database/mysql";
import {Storage} from "services-comun/modules/fs/storage";
import {Google} from "services-comun/modules/utiles/config";
import db from "services-comun/modules/utiles/mysql";
import {Configuracion} from "../utiles/config";

export class Bucket extends BucketBase {
    /* STATIC */
    public static async run(config: Configuracion, notify: INotify, cliente?: ICliente): Promise<void> {
        let bucket: Bucket;
        if (cliente==undefined) {
            bucket = await this.findBucket(notify.bucketId) as Bucket;
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

        await bucket.ingest(config.pod, config.google, notify)
            .then(()=>this.endProcesando(notify))
            .catch(err=>this.addRepesca(notify, cliente, err));
    }

    public static async searchBuckets(): Promise<Bucket[]> {
        return await db.query(`SELECT id, cliente, grupo FROM buckets`, [], {
            fn: (row)=>new this(row),
        });
    }

    /* INSTANCE */
    public async pescarHuerfanos(google: Google, fechas: string[]) {
        const bloques = await Promise.all(fechas.map(fecha=>Storage.list(google, this.id, fecha)));
        const files: IInsert[] = bloques.flat().map(file=>({
            table: "repesca",
            query: "INSERT INTO repesca (bucket, archivo) VALUES (?, ?)",
            params: [this.id, file.name],
            duplicate: ["bucket", "archivo"],
        }));
        await db.bulkInsert(files);
        await db.update("UPDATE repesca, procesando SET repesca.tratando=1 WHERE repesca.bucket=procesando.bucket AND repesca.archivo=procesando.archivo");
    }
}
