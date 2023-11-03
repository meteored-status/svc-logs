import {Conexion} from "../conexion";
import {Configuracion} from "../../utiles/config";
import {IRouteGroup} from "../routes/group/block";
import {RouteGroupError} from "../routes/group";

class Error extends RouteGroupError {
    /* STATIC */

    /* INSTANCE */
    protected getHandlers(): IRouteGroup[] {
        return [
            {
                expresiones: [
                    { metodos: ["ALL"], comodin: true, resumen: '/{url}', checkQuery: false, },
                ],
                handler: async (conexion) => {
                    return conexion.error(404, "Unknown request");
                },
            },
        ];
    }

    public async handleError(conexion: Conexion, status: number, mensaje: string, extra?: any): Promise<number> {
        return conexion
            .setStatus(status)
            .setContentTypeJSON()
            .sendRespuesta({
                ok: false,
                expiracion: Date.now(),
                info: {
                    message: mensaje,
                    extra: extra,
                },
            });
    }
}

let instancia: Error|null = null;
export default (config: Configuracion)=>{
    return instancia??=new Error(config);
};
