import {RouteGroup} from "services-comun/modules/net/routes/group";
import {IRouteGroup} from "services-comun/modules/net/routes/group/block";
import {error, info} from "services-comun/modules/utiles/log";

import {Bucket, INotifyPubSub} from "../../data/bucket";
import {Configuracion} from "../../utiles/config";

interface IQuery {
    bucket: string;
    archivo: string;
    cliente?: string;
    grupo?: string;
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
    protected getHandlers(): IRouteGroup[] {
        return [
            {
                expresiones: [
                    {
                        metodos: ["GET"],
                        exact: "/private/logs/ingest/",
                        query: {
                            bucket: {
                                cualquiera: 2,
                            },
                            archivo: {
                                cualquiera: 2,
                            },
                            cliente: {
                                cualquiera: 2,
                                opcional: true,
                            },
                            grupo: {
                                cualquiera: 2,
                                opcional: true,
                            },
                        },
                        resumen: "/private/logs/ingest/",
                    },
                ],
                handler: async (conexion) => {
                    const query = conexion.getQuery<IQuery>();

                    return Bucket.run(this.configuracion, {
                        bucketId: query.bucket,
                        objectId: query.archivo,
                    }, query.cliente!=undefined?{
                        id: query.cliente,
                        grupo: query.grupo,
                    }: undefined)
                        .then(()=>this.sendRespuesta(conexion))
                        .catch((err)=>this.sendError(conexion, {
                            message: "Error ingestando registro",
                            extra: err,
                        }));
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
                        // info("Ingestando", post.message.attributes.bucketId, post.message.attributes.objectId)
                        Bucket.runPubSub(this.configuracion, post.message.attributes)
                            .catch(async (err) => {
                                await Bucket.addRepesca(post.message.attributes, undefined, err);
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

