/// <reference path="./modules/types.d.ts" />
import emitter from "node:events";
import http from "node:http";

import type {IConfiguracionLoader} from "./modules/utiles/config";
import type {IEngine} from "./modules/engine_base";
import {error, info, warning} from "./modules/utiles/log";
import {PromiseDelayed} from "./modules/utiles/promise";

const KUBERNETES = process.env["KUBERNETES"]=="true";

emitter.setMaxListeners(256);

export interface IMainConfig {
}

export interface IMain {
    Engine: IEngine;
    configLoader: IConfiguracionLoader;
    unix: number;
}

export class Main {
    protected static CRONJOB: boolean = false;

    private static async checkSidecar(): Promise<void> {
        return new Promise<void>((resolve, reject)=>{
            let resuelto = false;
            const conexion = http.get("http://localhost:15020/healthz/ready", (message)=>{
                message.on("error", ()=>undefined);
                message.on("end", ()=>undefined);
                if (!resuelto) {
                    resuelto = true;
                    if (message.statusCode==200) {
                        resolve();
                    } else {
                        reject(new Error(message.statusMessage));
                    }
                }
            });
            conexion.on("error", (err)=>{
                if (!resuelto) {
                    resuelto = true;
                    reject(err);
                }
            });
        });
    }

    private static async stopSidecar(): Promise<void> {
        if (KUBERNETES) {
            await new Promise<void>((resolve)=>{
                let resuelto = false;
                const conexion = http.request({
                    protocol: "http:",
                    method: "POST",
                    hostname: "localhost",
                    port: 15020,
                    path: "/quitquitquit",
                }, (message)=>{
                    message.on("error", ()=>undefined);
                    message.on("end", ()=>undefined);
                    if (!resuelto) {
                        resuelto = true;
                        resolve();
                    }
                });

                conexion.on("error", ()=>{
                    if (!resuelto) {
                        resuelto = true;
                        resolve();
                    }
                })

                conexion.end();
            });
        }
    }

    protected static async startSidecar(): Promise<void> {
        if (KUBERNETES) {
            let intentos=0;
            let ok: boolean;
            do {
                intentos++;
                ok = await this.checkSidecar().then(async ()=>{
                    return true;
                }).catch(async ()=>{
                    await PromiseDelayed(intentos*100);
                    return false;
                });
            } while(!ok && intentos<=10);
        }
    }

    protected static async start<T extends IMainConfig>({Engine, configLoader, unix}: IMain, cfg: Partial<T>): Promise<void> {
        info("Iniciando Engine");
        await this.startSidecar();

        const configuracion = await configLoader.load();
        configLoader.load = () => { throw new Error("Solo se puede cargar la configuración una vez"); };
        this.CRONJOB = configuracion. pod.cronjob;
        const engine = await Engine.build(configuracion, unix);
        try {
            await engine.master();
        } catch (err) {
            error("Error iniciando el Master Engine", err);
        }
        await engine.ejecutar();
        if (configuracion.pod.cronjob) {
            await this.stopSidecar();
            info("Proceso terminado");
            process.exit();
        } else {
            process.on("warning", (warn) => {
                // alertas desactivadas globales
                if (["ExperimentalWarning"].includes(warn.name)) {
                    return;
                }

                // alertas desactivadas en producción
                if (PRODUCCION && !TEST && ["DeprecationWarning"].includes(warn.name)) {
                    return;
                }

                warning("Advertencia:", warn.name, warn.stack);
            });
        }
    }

    public static ejecutar<T extends IMainConfig=IMainConfig>(Engine: IEngine, configLoader: IConfiguracionLoader, cfg: Partial<T>={}): void {
        this.start<T>({Engine, configLoader, unix: Date.now()}, cfg).then(async ()=>undefined).catch(async (err)=>{
            error("Error iniciando el Engine", err);
            if (this.CRONJOB) {
                try {
                    await this.stopSidecar();
                } finally {
                    process.exit(0);
                }
            } else {
                process.exit(1);
            }
        });

    }
}
