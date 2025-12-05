import {RouteGroup} from "services-comun/modules/net/routes/group";
import type {IRouteGroup} from "services-comun/modules/net/routes/group/block";
import {error} from "services-comun/modules/utiles/log";

import {ClienteGCS} from "../../data/cliente/gcs";
import type {Configuracion} from "../../utiles/config";

interface IMessasge {
    protoPayload: {
        resourceName: string;
    };
}

class Slave extends RouteGroup<Configuracion>{
    /* INSTANCE */
    protected getHandlers(): IRouteGroup[] {
        return [
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
                            // await ClienteGCS.addStatusProcesando(bucket, path);
                            const cliente = await ClienteGCS.searchBucket(bucket, path);
                            await cliente.ingest(this.configuracion.google, path);

                            return this.sendRespuesta(conexion);
                        } catch (err) {
                            if (err instanceof Error) {
                                error("Error procesando", bucket, path, err.message);
                                // return conexion.error(err.message);
                            } else {
                                error("Error procesando", bucket, path, err);
                                // return conexion.error(JSON.stringify(err));
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

