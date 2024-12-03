import {Bucket as BucketBase, type ICliente} from "workers-base/modules/data/bucket";
import {info} from "services-comun/modules/utiles/log";

import {type Configuracion} from "../utiles/config";

interface INotify {
    bucketId: string;
    objectId: string;
}

export interface INotifyPubSub extends INotify {
    eventTime: string;
    eventType: string;
    notificationConfig: string;
    objectGeneration: string;
    payloadFormat: string;
}

export class Bucket extends BucketBase {
    /* STATIC */
    public static async run(config: Configuracion, notify: INotifyPubSub, signal: AbortSignal): Promise<void> {
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
        };
        await this.update(notify, cliente);
        await this.procesando(notify);
        await bucket.ingest(config.google, notify, signal, false)
            .then(()=>this.endProcesando(notify))
            .catch(err=>this.addRepesca(notify, false, cliente, err));
    }

    /* INSTANCE */
}
