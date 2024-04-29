import {Checker} from "../checkers";
import type {Conexion} from "../conexion";
import type {Configuracion} from "../../utiles/config";
import {ErrorCode, type IErrorInfo, type IOK, type IRespuestaKO, type IRespuestaOK} from "../interface";
import type {IErrorHandler} from "../router";
import {type IRouteGroup, RouteGroupBlock} from "./group/block";
import type {NetCache} from "../cache";
import {Respuesta} from "../respuesta";

export interface IRouteGroupParams {
    documentable: boolean;
}

export interface IConfigError {
    cache: Date;
    status: number;
}

export abstract class RouteGroup<T extends Configuracion=Configuracion> {
    private readonly handlers: RouteGroupBlock[];
    public readonly params: IRouteGroupParams;

    public get ok(): boolean {
        for (const actual of this.handlers) {
            if (!actual.ok) {
                return false;
            }
        }

        return true;
    }

    public constructor(protected readonly configuracion: T, params?: Partial<IRouteGroupParams>) {
        this.handlers = this.getHandlers().map(actual=>RouteGroupBlock.build(actual));
        this.params = {
            documentable: true,
            ...params,
        };
    }

    protected abstract getHandlers(): IRouteGroup[];

    public getDocumentables(): Checker[] {
        const salida: Checker[] = [];
        for (const actual of this.handlers) {
            if (!actual.documentable) {
                continue;
            }
            salida.push(...actual.getDocumentables());
        }

        return salida;
    }

    public async check(conexion: Conexion): Promise<boolean> {
        const metodo = conexion.metodo;

        for (const handler of this.handlers) {
            if (await handler.check(this.configuracion.pod, conexion, metodo)) {
                return !handler.stop;
            }
        }
        return false;
    }

    public setCache(cache: NetCache): void {
        for (const actual of this.handlers) {
            actual.setCache(cache);
        }
    }

    protected async sendRespuesta<T=undefined>(conexion: Conexion, {expiracion, etag, data}: Partial<IOK<T>> = {}): Promise<number> {
        if (expiracion==undefined) {
            expiracion = new Date();
            conexion
                .noCache();
        } else {
            conexion
                .setCache(expiracion);
        }
        if (etag!=undefined) {
            conexion
                .setETag(etag);
            if (conexion.ifNoneMatch == `"${etag}"`) {
                return conexion.send304();
            }
        }
        return conexion
            .sendRespuesta<IRespuestaOK<T|undefined>>({
                ok: true,
                expiracion: expiracion.getTime(),
                data,
            });
    }

    protected async sendError(conexion: Respuesta, data?: Partial<IErrorInfo>, {cache, status}: Partial<IConfigError>={}): Promise<number> {
        if (cache==undefined) {
            conexion
                .noCache()
                .unsetETag()
                .unsetLastModified()
                .unsetVary()
        } else {
            conexion
                .setCache(cache);
        }
        if (status!=undefined) {
            conexion
                .setStatus(status);
        }

        return conexion
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

}

export abstract class RouteGroupError<T extends Configuracion=Configuracion> extends RouteGroup<T> implements IErrorHandler {
    public abstract handleError(conexion: Respuesta, status: number, mensaje: string, extra?: any): Promise<number>;
}
