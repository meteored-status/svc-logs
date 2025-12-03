import {ClienteGCS} from "logs-base/modules/data/cliente/gcs";
import {RouteGroup} from "services-comun/modules/net/routes/group";
import type {IRouteGroup} from "services-comun/modules/net/routes/group/block";
import {error} from "services-comun/modules/utiles/log";
// import {type ILogErrorPOST, LogError} from "../../data/error";
// import {type ILogServicioPOST, LogServicio} from "../../data/servicio";

import {type Configuracion} from "../../utiles/config";

// interface INotifyPubSub {
//     bucketId: string;
//     objectId: string;
//     eventTime: string;
//     eventType: string;
//     notificationConfig: string;
//     objectGeneration: string;
//     payloadFormat: string;
// }
//
// interface IPubSub {
//     message: {
//         attributes: INotifyPubSub;
//         data: string;
//         messageId: string;
//         message_id: string;
//         publishTime: string;
//         publish_time: string;
//     };
//     subscription: string;
// }

interface IMessasge {
    protoPayload: {
        resourceName: string;
    };
}

class Slave extends RouteGroup<Configuracion>{
    /* INSTANCE */
    protected getHandlers(): IRouteGroup[] {
        return [
            // {
            //     expresiones: [
            //         {
            //             metodos: ["POST"],
            //             exact: "/service/logs/service/",
            //             checkQuery: false,
            //             resumen: "/service/logs/service/",
            //         },
            //     ],
            //     handler: async (conexion) => {
            //         const post = conexion.post as ILogServicioPOST;
            //
            //         conexion.noCache();
            //
            //         const salida = await this.sendRespuesta(conexion);
            //
            //         LogServicio.ingest(post);
            //
            //         return salida;
            //     },
            // },
            // {
            //     expresiones: [
            //         {
            //             metodos: ["POST"],
            //             exact: "/service/logs/error/",
            //             checkQuery: false,
            //             resumen: "/service/logs/error/",
            //         },
            //     ],
            //     handler: async (conexion) => {
            //         const post = conexion.post as ILogErrorPOST;
            //
            //         conexion.noCache();
            //
            //         const salida = await this.sendRespuesta(conexion);
            //
            //         LogError.ingest(post, this.configuracion);
            //
            //         return salida;
            //     },
            // },
            {
                expresiones: [
                    {
                        metodos: ["POST"],
                        exact: "/",
                        checkQuery: false,
                        resumen: "/",
                    },
                ],
                handler: async (conexion) => {
                    const post = conexion.post as Partial<IMessasge>;

                    conexion.noCache();

                    if (post.protoPayload?.resourceName) {
                        const [base, path] = post.protoPayload.resourceName.split("/objects/");
                        const bucket = base.substring(19); // quitamos el trozo de projects/_/buckets/
                        try {
                            await ClienteGCS.addStatusProcesando(bucket, path);
                            const cliente = await ClienteGCS.searchBucket(bucket, path);
                            await cliente.ingest(this.configuracion.pod, this.configuracion.google, path);

                            return this.sendRespuesta(conexion);
                        } catch (err) {
                            if (err instanceof Error) {
                                error("Error procesando", bucket, path, err.message);
                                return conexion.error(err.message);
                            } else {
                                error("Error procesando", bucket, path, err);
                                return conexion.error(JSON.stringify(err));
                            }
                        }
                    }

                    return this.sendRespuesta(conexion);
                },
            },
        ];
    }
}

export default (config: Configuracion)=>new Slave(config);

