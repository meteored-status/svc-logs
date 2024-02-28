import type {Configuracion} from "../../utiles/config";
import {EngineServer} from "../../engine_server";
import type {IRouteGroup} from "../routes/group/block";
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
                    return this.engine.started()
                        .then(() => this.sendRespuesta(conexion))
                        .catch((err) => conexion.error(404, err));
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
                    return this.engine.ready()
                        .then(() => this.sendRespuesta(conexion))
                        .catch((err) => conexion.error(404, err));
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
                    return this.engine.okAll()
                        .then(() => this.sendRespuesta(conexion))
                        .catch((err) => conexion.error(404, err));
                },
            },
            {
                expresiones: [
                    {
                        metodos: ["GET"],
                        exact: "/admin/doc/",
                        resumen: "/admin/doc/",
                        log: false,
                    },
                ],
                handler: async (conexion)=>{
                    const doc = this.engine.routes?.getDocumentables();
                    return this.sendRespuesta(conexion);
                },
            },
        ];
    }
}

let instancia: Admin|null = null;
export default (config:Configuracion, engine: EngineServer)=>{
    return instancia??=new Admin(config, engine);
};
