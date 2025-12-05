import {RouteGroup} from "services-comun/modules/net/routes/group";
import type {IRouteGroup} from "services-comun/modules/net/routes/group/block";

import type {Configuracion} from "../../utiles/config";
import {type ILogErrorPOST, ingest as ingestError} from "../../data/error";
import {type ILogServicioPOST, ingest as ingestLog} from "../../data/servicio";

class Slave extends RouteGroup<Configuracion>{
    /* INSTANCE */
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

                    ingestLog(post);

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

                    ingestError(post, this.configuracion);

                    return salida;
                },
            },
        ];
    }
}

export default (config: Configuracion)=>new Slave(config);

