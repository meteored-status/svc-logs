/**
 * Editor: José Antonio Jiménez
 * Fecha: Mon, 18 May 2026 10:42:05 GMT
 * Hash: 81b61dce670143ea013f13fbbec2e82d
 * Versión: 2026.5.18+2-josantoniojimnez
 */

import type {Configuracion} from "services-comun/modules/utiles/config";

import type {Conexion} from "../conexion";
import type {IRouteGroup} from "../routes/group/block";
import {RouteGroupError} from "../routes/group";

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

let instancia: HttpErrorHandler|null = null;
export default (config: Configuracion): HttpErrorHandler => {
    return instancia ??= new HttpErrorHandler(config);
};
