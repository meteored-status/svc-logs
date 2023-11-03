import {Configuracion} from "../../utiles/config";
import {EngineServer} from "../../engine_server";
import {IRouteGroup} from "../routes/group/block";
import {RouteGroup} from "../routes/group";

class Admin extends RouteGroup {
    /* STATIC */

    /* INSTANCE */
    public constructor(config: Configuracion, private readonly engine: EngineServer) {
        super(config);
    }

    protected getHandlers(): IRouteGroup[] {
        return [
            {
                expresiones: [
                    {
                        metodos: ["GET"],
                        exact: "/admin/started/",
                        resumen: "/admin/started/",
                        log: false,
                    },
                ],
                handler: async (conexion)=>{
                    return this.engine.started().then(()=>{
                        return this.sendRespuesta(conexion);
                    }).catch((err)=>{
                        return conexion.error(404, err);
                    });
                },
            },
            {
                expresiones: [
                    {
                        metodos: ["GET"],
                        exact: "/admin/ready/",
                        resumen: "/admin/ready/",
                        log: false,
                    },
                ],
                handler: async (conexion)=>{
                    return this.engine.ready().then(() => {
                        return this.sendRespuesta(conexion);
                    }).catch((err) => {
                        return conexion.error(404, err);
                    });
                },
            },
            {
                expresiones: [
                    {
                        metodos: ["GET"],
                        exact: "/admin/live/",
                        resumen: "/admin/live/",
                        log: false,
                    },
                    {
                        metodos: ["GET"],
                        exact: "/admin/check/",
                        resumen: "/admin/check/",
                        log: false,
                    },
                ],
                handler: async (conexion)=>{
                    return this.engine.okAll().then(()=>{
                        return this.sendRespuesta(conexion);
                    }).catch((err)=>{
                        return conexion.error(404, err);
                    });
                },
            },
            // {
            //     expresiones: [
            //         {
            //             metodos: ["GET"],
            //             exact: "/admin/status/",
            //             resumen: "/admin/status/",
            //         },
            //     ],
            //     handler: async (conexion)=>{
            //         // const memoria = process.memoryUsage();
            //         return conexion.sendRespuesta<IRespuesta<void>>({
            //             ...Conexion.baseDefecto(),
            //             // data: {
            //             //     listado: ["admconfig", "status"],
            //             //     respuesta: {
            //             //         admconfig: [
            //             //             {
            //             //                 pod: this.configuracion.pod.host,
            //             //                 servicio: this.configuracion.pod.servicio,
            //             //                 zona: this.configuracion.pod.zona,
            //             //                 // propiedades: this.configuracion.getUpdateables(),
            //             //             },
            //             //         ],
            //             //         status: [
            //             //             {
            //             //                 pod: this.configuracion.pod.host,
            //             //                 servicio: this.configuracion.pod.servicio,
            //             //                 zona: this.configuracion.pod.zona,
            //             //                 memoria: {
            //             //                     heap: `${formatMemoria(memoria.heapUsed)}/${formatMemoria(memoria.heapTotal)}`,
            //             //                     buffers: memoria.arrayBuffers?formatMemoria(memoria.arrayBuffers):undefined,
            //             //                     externa: formatMemoria(memoria.external),
            //             //                     rss: formatMemoria(memoria.rss),
            //             //                 },
            //             //                 version: this.configuracion.pod.version,
            //             //                 uptime: formatTiempo(Date.now()-this.engine.inicio),
            //             //                 peticiones: server.peticiones,
            //             //             },
            //             //         ],
            //             //     },
            //             // },
            //         });
            //     },
            // },
        ];
    }
}

let instancia: Admin|null = null;
export default (config:Configuracion, engine: EngineServer)=>{
    return instancia??=new Admin(config, engine);
};
