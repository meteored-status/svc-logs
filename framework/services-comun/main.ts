import * as http from "node:http";
import emitter from "node:events";

import type {} from "./modules/types.d.ts";
import {info, error, warning} from "./modules/utiles/log";

import {type IConfiguracionLoader} from "./modules/utiles/config";
import {type IEngine} from "./modules/engine_base";
import {PromiseDelayed} from "./modules/utiles/promise";

const KUBERNETES = process.env["KUBERNETES"]=="true";

emitter.setMaxListeners(256);

export interface IMainConfig {
}

export class Main {
    protected static CRONJOB: boolean = false;

    private static async checkSidecar(): Promise<void> {
        return new Promise<void>((resolve, reject)=>{
            let resuelto = false;
            const conexion = http.get("http://localhost:15020/healthz/ready", (message)=>{
                message.on("error", ()=>{});
                message.on("end", ()=>{});
                if (!resuelto) {
                    resuelto = true;
                    if (message.statusCode==200) {
                        resolve();
                    } else {
                        reject();
                    }
                }
            });
            conexion.on("error", ()=>{
                if (!resuelto) {
                    resuelto = true;
                    reject();
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
                    message.on("error", ()=>{});
                    message.on("end", ()=>{});
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
            let intentos=1;
            let ok: boolean;
            do {
                ok = await this.checkSidecar().then(async ()=>{
                    return true;
                }).catch(async ()=>{
                    await PromiseDelayed(intentos*100);
                    return false;
                });
            } while(!ok && intentos<=10);
        }
    }

    protected static async start<T extends IMainConfig>(Engine: IEngine, configLoader: IConfiguracionLoader, unix: number, cfg: Partial<T>): Promise<void> {
        info("Iniciando Engine");
        await this.startSidecar();

        const configuracion = await configLoader.load();
        this.CRONJOB = configuracion.pod.cronjob;
        const engine = await Engine.build(configuracion, unix);
        await engine.ejecutar();
        if (configuracion.pod.cronjob) {
            await this.stopSidecar();
            info("Proceso terminado");
            process.exit();
        } else {
            process.on('warning', (warn) => {
                if (["ExperimentalWarning"].includes(warn.name)) {
                    return;
                }
                warning("Advertencia:", warn.stack);
            });
        }
    }

    public static ejecutar<T extends IMainConfig=IMainConfig>(Engine: IEngine, configuracion: IConfiguracionLoader, cfg: Partial<T>={}): void {
        this.start<T>(Engine, configuracion, Date.now(), cfg).then(async ()=>{}).catch(async (err)=>{
            error("Error iniciando el Engine", err);
            if (this.CRONJOB) {
                try {
                    await this.stopSidecar();
                } catch (err) {}
                process.exit(0);
            } else {
                process.exit(1);
            }
        });

    }
}
