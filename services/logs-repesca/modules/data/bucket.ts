// import {Bucket as BucketBase, type ICliente} from "logs-base/modules/data/bucket";
// import {type INotify} from "services-comun-status/modules/services/logs-slave/backend";
//
// import {type Configuracion} from "../utiles/config";
//
// export class Bucket extends BucketBase {
//     /* STATIC */
//     public static async run(config: Configuracion, notify: INotify, cliente?: ICliente): Promise<void> {
//         let bucket: Bucket;
//         if (cliente==undefined) {
//             bucket = await this.findBucket(notify.bucketId);
//             cliente = {
//                 id: bucket.cliente,
//                 grupo: bucket.grupo,
//             }
//             await this.update(notify, cliente);
//         } else {
//             bucket = new this({
//                 id: notify.bucketId,
//                 cliente: cliente.id,
//                 grupo: cliente.grupo ?? null,
//             });
//         }
//
//         await this.repescando(notify);
//
//         await bucket.ingest(config.pod, config.google, notify)
//             .then(()=>this.endProcesando(notify))
//             .catch(err=>this.addRepesca(notify, cliente, err));
//     }
//
//     /* INSTANCE */
// }
