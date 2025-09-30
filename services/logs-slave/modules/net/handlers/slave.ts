import {ClienteGCS} from "logs-base/modules/data/cliente/gcs";
import {RouteGroup} from "services-comun/modules/net/routes/group";
import type {IRouteGroup} from "services-comun/modules/net/routes/group/block";
import {error, info} from "services-comun/modules/utiles/log";
import {PromiseDelayed} from "services-comun/modules/utiles/promise";
import {type ILogErrorPOST, LogError} from "../../data/error";
import {type ILogServicioPOST, LogServicio} from "../../data/servicio";

import {type Configuracion} from "../../utiles/config";

interface INotifyPubSub {
    bucketId: string;
    objectId: string;
    eventTime: string;
    eventType: string;
    notificationConfig: string;
    objectGeneration: string;
    payloadFormat: string;
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
    /* INSTANCE */
    private parseLog(notify: INotifyPubSub): void {
        PromiseDelayed()
            .then(async ()=>{
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

                await ClienteGCS.addStatusProcesando(notify.bucketId, notify.objectId);
                const cliente = await ClienteGCS.searchBucket(notify.bucketId);
                await cliente.ingest(this.configuracion.pod, this.configuracion.google, notify.objectId);
            })
            .catch(async (err)=>{
                if (err instanceof Error) {
                    if (err.message.startsWith("Duplicate entry")) {
                        return;
                    }
                    error("Error procesando", notify.objectId, err.message);
                } else {
                    error("Error procesando", notify.objectId, err);
                }
            })
            .catch((err)=>{
                error("Error procesando", notify.objectId, err);
            });
    }

    protected getHandlers(): IRouteGroup[] {
        return [
            {
                expresiones: [
                    {
                        metodos: ["POST"],
                        exact: "/service/logs/service/",
                        checkQuery: false,
                        resumen: "/service/logs/service/",
                    },
                ],
                handler: async (conexion) => {
                    const post = conexion.post as ILogServicioPOST;

                    conexion.noCache();

                    const salida = await this.sendRespuesta(conexion);

                    LogServicio.ingest(post);

                    return salida;
                },
            },
            {
                expresiones: [
                    {
                        metodos: ["POST"],
                        exact: "/service/logs/error/",
                        checkQuery: false,
                        resumen: "/service/logs/error/",
                    },
                ],
                handler: async (conexion) => {
                    const post = conexion.post as ILogErrorPOST;

                    conexion.noCache();

                    const salida = await this.sendRespuesta(conexion);

                    LogError.ingest(post, this.configuracion);

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
                        this.parseLog(post.message.attributes);
                    }

                    return salida;
                },
            },
        ];
    }
}

let instancia: Slave|null = null;
export default (config: Configuracion)=>{
    return instancia??=new Slave(config);
};

