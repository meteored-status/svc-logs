import cluster, {type Worker} from "node:cluster";
import os from "node:os";

import {Configuracion, type IConfiguracionLoader} from "./modules/utiles/config";
import {error, info, warning} from "./modules/utiles/log";
import {type IEngine} from "./modules/engine_base";
import {IMain, type IMainConfig, Main as MainBase} from "./main";
import telemetry, {type ITelemetryConfig} from "./modules/telemetry";

enum ClusterStatus {
    RUNNING,
    STOPPED,
}

export interface IClusterConfig extends IMainConfig {
    minimo_hilos: number;
    telemetry: Partial<ITelemetryConfig>;
}

export interface ICluster {
    Engine: IEngine;
    configuracion: Configuracion;
    unix: number;
}

export class Main extends MainBase {
    /* STATIC */
    // private static MINIMO_HILOS = PRODUCCION ?
    //     Math.max(1, os.availableParallelism()) :
    //     1;

    private static SLAVES: Map<Worker, ClusterStatus> = new Map<Worker, ClusterStatus>();

    private static addSlave(): void {
        const worker = cluster.fork();

        this.SLAVES.set(worker, ClusterStatus.RUNNING);

        worker.on("message", (message)=>{
            switch (message.cmd) {
                case "spawn":
                    this.addSlave();
                    break;
                case undefined:
                    break;
                default:
                    info("Mensaje recibido en slave", worker.id, message);
                    break;
            }
        });
    }

    private static async startMaster({Engine, configuracion, unix}: ICluster, hilos: number): Promise<void> {
        info("Iniciando Engine");
        const engine = await Engine.build(configuracion, unix);
        try {
            await engine.master();
        } catch (err) {
            error("Error iniciando el Master Engine", err);
        }
        for (let i=  0; i < hilos; i++) {
            this.addSlave();
        }
    }

    private static async startSlave({Engine, configuracion, unix}: ICluster): Promise<void> {
        info("Iniciando Worker");
        const engine = await Engine.build(configuracion, unix);
        await engine.ejecutar();
    }

    protected static override async start({Engine, configLoader, unix}: IMain, cfg: Partial<IClusterConfig>): Promise<void> {
        const config = this.buildConfig(cfg);
        await this.startSidecar();

        this.CRONJOB = false;

        const configuracion = await configLoader.load();
        if (cluster.isPrimary) {
            if  (config.minimo_hilos<1) {
                config.minimo_hilos = os.availableParallelism();
            }
            await this.startMaster({Engine, configuracion, unix}, config.minimo_hilos);
        } else {
            await this.startSlave({Engine, configuracion, unix});
        }

        process.on('warning', (warn) => {
            if (["ExperimentalWarning"].includes(warn.name)) {
                return;
            }
            warning("Advertencia:", warn.stack);
        });
    }

    private static buildConfig(cfg: Partial<IClusterConfig>): IClusterConfig {
        return {
            minimo_hilos: 2,
            telemetry: {},
            ...cfg,
        };
    }

    public static override ejecutar(Engine: IEngine, configuracion: IConfiguracionLoader, cfg: Partial<IClusterConfig>={}): void {
        const config = this.buildConfig(cfg);
        telemetry(config.telemetry);
        super.ejecutar<IClusterConfig>(Engine, configuracion, config);
    }
}
