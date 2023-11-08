import {type INotify} from "services-comun-status/modules/services/logs-slave/backend";
import {RouteGroup} from "services-comun/modules/net/routes/group";
import {type IRouteGroup} from "services-comun/modules/net/routes/group/block";
import {error} from "services-comun/modules/utiles/log";

import {Bucket, type INotifyPubSub} from "../../data/bucket";
import {type Configuracion} from "../../utiles/config";

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
    private parse(data: INotifyPubSub): void {
        Bucket.run(this.configuracion, data, this.signal)
            .catch(async (err) => {
                await Bucket.addRepesca(data, undefined, err);
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
                        prefix: "/private/logs/ingest/",
                        checkQuery: false,
                        resumen: "/private/logs/ingest/",
                    },
                ],
                handler: async (conexion) => {
                    const post = conexion.post as INotify;

                    conexion.noCache();

                    const salida = await this.sendRespuesta(conexion);

                    this.parse({
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
                        prefix: "/pubsub/logs/ingest/",
                        checkQuery: false,
                        resumen: "/pubsub/logs/ingest/",
                    },
                ],
                handler: async (conexion) => {
                    const post = conexion.post as IPubSub;

                    conexion.noCache();

                    const salida = await this.sendRespuesta(conexion);

                    if (post.message?.attributes!=undefined) {
                        this.parse(post.message.attributes);
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

