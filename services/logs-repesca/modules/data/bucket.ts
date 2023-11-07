import {Bucket as BucketBase} from "logs-base/modules/data/bucket";
import {type IInsert} from "services-comun/modules/database/mysql";
import {Storage} from "services-comun/modules/fs/storage";
import {Google} from "services-comun/modules/utiles/config";
import db from "services-comun/modules/utiles/mysql";

export class Bucket extends BucketBase {
    /* STATIC */
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
