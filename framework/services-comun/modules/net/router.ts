import {Conexion} from "./conexion";
import {Routes} from "./routes";
import {Respuesta} from "./respuesta";
import {PromiseDelayed} from "../utiles/promise";

export interface IErrorHandler {
    handleError: (conexion: Respuesta, status: number, mensaje: string, extra?: any)=>Promise<number>;
}

export interface IShutdownHandler {
    handleShutdown: (conexion: Respuesta)=>Promise<number>;
}

export class Router {
    public static async route(handlers: Routes, conexion: Conexion): Promise<void> {
        await PromiseDelayed(0);
        try {
            if (!await handlers.check(conexion).catch(()=>false)) {
                await handlers.error.check(conexion).catch(()=>{});
            }
        } catch(err) {
            await handlers.error.check(conexion).catch(()=>{});
        }
    }
}
