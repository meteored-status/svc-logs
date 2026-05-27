import fs from "node:fs";

import type {Configuracion} from "services-comun/modules/utiles/config";
import {exists} from "services-comun/modules/utiles/fs";

import type {IRouteGroup} from "../routes/group/block";
import {RouteGroup} from "../routes/group";

/**
 * Grupo de rutas que sirve el favicon del sitio.
 *
 * - `GET /favicon.ico` — devuelve el fichero `assets/favicon.ico` con caché de 1 mes.
 *   Si el fichero no existe responde con un `404 no cache`.
 *
 * No se incluye en la documentación pública.
 */
class Favicon extends RouteGroup {
    public constructor(config: Configuracion) {
        super(config, {
            documentable: false,
        });
    }

    protected getHandlers(): IRouteGroup[] {
        return [
            {
                expresiones: [
                    {metodos: ["GET"], exact: "/favicon.ico", resumen: "/favicon.ico", log: false},
                ],
                handler: async (conexion) => {
                    if (!await exists("assets/favicon.ico")) {
                        return conexion
                            .noCache()
                            .error(404, "favicon not found");
                    }

                    return conexion
                        .setCache1Mes()
                        .setContentType("image/x-icon")
                        .sendStream(fs.createReadStream("assets/favicon.ico"));
                },
            },
        ];
    }
}

let instancia: Favicon|null = null;
export default (config: Configuracion): Favicon => {
    return instancia ??= new Favicon(config);
};
