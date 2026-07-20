/**
 * Editor: José Antonio Jiménez
 * Fecha: Wed, 17 Jun 2026 11:12:28 GMT
 * Hash: 29f3ee1db989f5ad21b1e1c6a248e1e9
 * Versión: 2026.6.17+1-josantoniojimnez
 */

import fs from "node:fs";

import type {IRouteGroup} from "@mr/core-network/server/http/routes/group/block";
import {RouteGroup} from "@mr/core-network/server/http/routes/group";
import {exists} from "services-comun/modules/utiles/fs";

import type {Configuracion} from "../config";

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

export default (config: Configuracion): Favicon => new Favicon(config);
