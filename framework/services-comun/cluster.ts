import cluster, {type Worker} from "node:cluster";
import os from "node:os";

import {Configuracion, type IConfiguracion, type IConfiguracionLoader} from "./modules/utiles/config";
import {type IEngine} from "./modules/engine_base";
import {type IMainConfig, Main as MainBase} from "./main";
import {info, warning} from "./modules/utiles/log";
import telemetry, {type ITelemetryConfig} from "./modules/telemetry";

enum ClusterStatus {
    RUNNING,
    STOPPED,
}

export interface IClusterConfig extends IMainConfig {
    minimo_hilos: number;
    telemetry: Partial<ITelemetryConfig>;
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

    private static async startMaster(hilos: number): Promise<void> {
        info("Iniciando Engine");
        for (let i=  0; i < hilos; i++) {
            this.addSlave();
        }
    }

    private static async startSlave(Engine: IEngine, configuracion: Configuracion<IConfiguracion>, unix: number): Promise<void> {
        info("Iniciando Worker");
        const engine = await Engine.build(configuracion, unix);
        await engine.ejecutar();
    }

    protected static override async start(Engine: IEngine, configLoader: IConfiguracionLoader, unix: number, cfg: Partial<IClusterConfig>): Promise<void> {
        const config = this.buildConfig(cfg);
        await this.startSidecar();

        this.CRONJOB = false;

        if (cluster.isPrimary) {
            if  (config.minimo_hilos<1) {
                config.minimo_hilos = os.availableParallelism();
            }
            await this.startMaster(config.minimo_hilos);
        } else {
            const configuracion = await configLoader.load();
            await this.startSlave(Engine, configuracion, unix);
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
