import {NetCache} from "../cache";
import {Conexion} from "../conexion";
import {Configuracion} from "../../utiles/config";
import {ErrorCode, IErrorInfo, IOK, IRespuestaKO, IRespuestaOK} from "../interface";
import {IErrorHandler} from "../router";
import {IRouteGroup, RouteGroupBlock} from "./group/block";
import {Respuesta} from "../respuesta";

export abstract class RouteGroup<T extends Configuracion=Configuracion> {
    private readonly handlers: RouteGroupBlock[];

    public setCache(cache: NetCache): void {
        for (const actual of this.handlers) {
            actual.setCache(cache);
        }
    }

    protected async sendRespuesta<T=undefined>(conexion: Respuesta, {expiracion, data}: Partial<IOK<T>> = {}): Promise<number> {
        if (expiracion==undefined) {
            expiracion = new Date();
            conexion
                .noCache();
        } else {
            conexion
                .setCache(expiracion);
        }
        return conexion
            .sendRespuesta<IRespuestaOK<T|undefined>>({
                ok: true,
                expiracion: expiracion.getTime(),
                data,
            });
    }

    protected async sendError(conexion: Respuesta, data?: Partial<IErrorInfo>): Promise<number> {
        return conexion
            .noCache()
            .unsetETag()
            .unsetLastModified()
            .unsetVary()
            .sendRespuesta<IRespuestaKO>({
                ok: false,
                expiracion: new Date().getTime(),
                info: {
                    code: ErrorCode.APPLICATION,
                    message: "Error interno",
                    ...data??{},
                },
            });
    }

    public get ok(): boolean {
        for (const actual of this.handlers) {
            if (!actual.ok) {
                return false;
            }
        }

        return true;
    }

    public constructor(protected configuracion: T) {
        this.handlers = this.getHandlers().map(actual=>RouteGroupBlock.build(actual));
    }

    protected abstract getHandlers(): IRouteGroup[];

    public async check(conexion: Conexion): Promise<boolean> {
        const metodo = conexion.metodo;

        for (const handler of this.handlers) {
            if (await handler.check(this.configuracion.pod, conexion, metodo)) {
                return !handler.stop;
            }
        }
        return false;
    }
}

export abstract class RouteGroupError<T extends Configuracion=Configuracion> extends RouteGroup<T> implements IErrorHandler {
    public abstract handleError(conexion: Respuesta, status: number, mensaje: string, extra?: any): Promise<number>;
}
