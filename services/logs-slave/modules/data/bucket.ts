import {Bucket as BucketBase, type ICliente} from "logs-base/modules/data/bucket";
import {type INotify} from "services-comun-status/modules/services/logs-slave/backend";
import {info} from "services-comun/modules/utiles/log";

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

    // public static async run(config: Configuracion, notify: INotify, cliente?: ICliente): Promise<void> {
    //     let bucket: Bucket;
    //     if (cliente==undefined) {
    //         bucket = await this.findBucket(notify.bucketId);
    //         cliente = {
    //             id: bucket.cliente,
    //             grupo: bucket.grupo,
    //         }
    //         await this.update(notify, cliente);
    //     } else {
    //         bucket = new this({
    //             id: notify.bucketId,
    //             cliente: cliente.id,
    //             grupo: cliente.grupo ?? null,
    //         });
    //     }
    //
    //     await this.repescando(notify);
    //
    //     await bucket.ingest(config.pod, config.google, notify, true)
    //         .then(()=>this.endProcesando(notify))
    //         .catch(err=>this.addRepesca(notify, cliente, err));
    // }

    /* INSTANCE */
}
