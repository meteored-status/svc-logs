import {RouteGroup} from "services-comun/modules/net/routes/group";
import {type IRouteGroup} from "services-comun/modules/net/routes/group/block";
import {error} from "services-comun/modules/utiles/log";

import {Bucket, type INotifyPubSub} from "../../data/bucket";
import {type Configuracion} from "../../utiles/config";

interface INotify {
    bucketId: string;
    objectId: string;
}

interface IPubSub {
    message: {
        attributes: INotifyPubSub;
        data: string;
        messageId: string;
        message_id: string;
        publishTime: string;
        publish_time: string;
    };
    subscription: string;
}

class Slave extends RouteGroup<Configuracion>{
    /* STATIC */

    /* INSTANCE */
    public constructor(configuracion: Configuracion, protected readonly signal: AbortSignal) {
        super(configuracion);
    }

    private parseWorker(data: INotifyPubSub): void {
        Bucket.run(this.configuracion, data, this.signal)
            .catch(async (err) => {
                await Bucket.addRepesca(data, false, undefined, err);
                if (err instanceof Error) {
                    if (err.message.startsWith("Duplicate entry")) {
                        return;
                    }
                    error("Error procesando", err.message);
                } else {
                    error("Error procesando", err);
                }
            });
    }

    protected getHandlers(): IRouteGroup[] {
        return [
            {
                expresiones: [
                    {
                        metodos: ["POST"],
                        prefix: "/private/workers/ingest/",
                        checkQuery: false,
                        resumen: "/private/workers/ingest/",
                    },
                ],
                handler: async (conexion) => {
                    const post = conexion.post as INotify;

                    conexion.noCache();

                    const salida = await this.sendRespuesta(conexion);

                    this.parseWorker({
                        ...post,
                        eventTime: "",
                        eventType: "OBJECT_FINALIZE",
                        notificationConfig: "",
                        objectGeneration: "",
                        payloadFormat: "",
                    });

                    return salida;
                },
            },
            {
                expresiones: [
                    {
                        metodos: ["POST"],
                        prefix: "/pubsub/workers/ingest/",
                        checkQuery: false,
                        resumen: "/pubsub/workers/ingest/",
                    },
                ],
                handler: async (conexion) => {
                    const post = conexion.post as IPubSub;

                    conexion.noCache();

                    const salida = await this.sendRespuesta(conexion);

                    if (post.message?.attributes!=undefined) {
                        this.parseWorker(post.message.attributes);
                    }

                    return salida;
                },
            },
        ];
    }
}

let instancia: Slave|null = null;
export default (config: Configuracion, signal: AbortSignal)=>{
    return instancia??=new Slave(config, signal);
};

