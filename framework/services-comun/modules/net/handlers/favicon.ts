import * as fs from "node:fs";

import {Configuracion} from "../../utiles/config";
import {IRouteGroup} from "../routes/group/block";
import {RouteGroup} from "../routes/group";
import {exists} from "../../utiles/fs";

class Favicon extends RouteGroup {
    /* STATIC */

    /* INSTANCE */
    protected getHandlers(): IRouteGroup[] {
        return [
            {
                expresiones: [
                    {
                        metodos: ["GET"],
                        exact: "/favicon.ico",
                        resumen: "/favicon.ico",
                        log: false,
                    },
                ],
                handler: async (conexion) => {

                    if (!await exists(`assets/favicon.ico`)) {
                        return conexion
                            .noCache()
                            .error(404, "favicon not found");
                    }

                    return conexion
                        .setCache1Mes()
                        .setContentType("image/x-icon")
                        .sendStream(fs.createReadStream(`assets/favicon.ico`));
                },
            },
        ];
    }
}

let instancia: Favicon|null = null;
export default (config: Configuracion)=>{
    return instancia??=new Favicon(config);
};
