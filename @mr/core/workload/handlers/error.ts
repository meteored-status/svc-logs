/**
 * Editor: José Antonio Jiménez
 * Fecha: Wed, 17 Jun 2026 11:12:28 GMT
 * Hash: e45a92ed24bb258631d3b5ff055871a9
 * Versión: 2026.6.17+1-josantoniojimnez
 */


import type {Conexion} from "@mr/core-network/server/http/conexion";
import type {IRouteGroup} from "@mr/core-network/server/http/routes/group/block";
import {RouteGroupError} from "@mr/core-network/server/http/routes/group";

import type {Configuracion} from "../config";

/**
 * Handler de error por defecto del servidor HTTP.
 *
 * Responde a cualquier URL no reconocida con un `404` y gestiona los errores HTTP
 * propagados desde el router devolviendo una respuesta JSON con el código y
 * el mensaje del error.
 */
class HttpErrorHandler extends RouteGroupError {
    public constructor(config: Configuracion) {
        super(config, {
            documentable: false,
        });
    }

    protected getHandlers(): IRouteGroup[] {
        return [
            {
                expresiones: [
                    {metodos: ["ALL"], comodin: true, resumen: "/{url}", checkQuery: false},
                ],
                handler: async (conexion) => conexion.error(404, "Unknown request"),
            },
        ];
    }

    public async handleError(conexion: Conexion, status: number, mensaje: string, extra?: unknown): Promise<number> {
        // En producción nunca se incluye `extra` para evitar filtrar trazas, stacks o
        // datos internos al cliente. En desarrollo se mantiene para facilitar depuración.
        const info: {message: string; extra?: unknown} = {message: mensaje};
        if (!PRODUCCION && extra !== undefined) {
            info.extra = extra;
        }
        return conexion
            .setStatus(status)
            .setContentTypeJSON()
            .sendRespuesta({
                ok: false,
                expiracion: Date.now(),
                info,
            });
    }
}

export default (config: Configuracion): HttpErrorHandler => new HttpErrorHandler(config);
