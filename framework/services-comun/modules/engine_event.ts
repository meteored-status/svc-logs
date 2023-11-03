import chokidar from "chokidar";

import {Configuracion} from "./utiles/config";
import {EngineBase} from "./engine_base";
import {isDir, mkdir, safeWrite} from "./utiles/fs";
import {info} from "./utiles/log";
import {PromiseDelayed} from "./utiles/promise";

export abstract class EngineEvent<T extends Configuracion=Configuracion> extends EngineBase<T> {
    /* STATIC */

    /* INSTANCE */
    // protected constructor(configuracion: T, inicio: number) {
    //     super(configuracion, inicio);
    // }

    protected override init(): void {
        PromiseDelayed().then(async () => {
            await this.waitEventReady();
            await this.launchEventLive();
            if (!await isDir("files/tmp")) {
                return;
            }
            await mkdir("files/tmp/admin/", true);
            const watcher = chokidar.watch("files/tmp/admin/", {
                persistent: true,
            });
            watcher.on("add", (path) => {
                const fileName = path.split('/').pop();

                if (fileName === "shutdown.lock") {
                    // info("Se ha solicitado el apagado del POD");
                    this.shutdown().then(()=>{}).catch(()=>{});
                }
            });
        }).catch(() => {
            // Handle error here
        });
    }

    protected async writeLockFile(): Promise<void> {
        await safeWrite("files/tmp/run.lock", `${Date.now()}`, true)
            .catch(() => {
                // Handle error here
            });
    }

    protected async waitEventReady(): Promise<void> {
        return new Promise((resolve, reject) => {
            const interval = setInterval(() => {
                this.started()
                    .then(async () => {
                        clearInterval(interval);
                        await this.writeLockFile();
                        info("Gestor de eventos iniciado");
                        resolve();
                    })
                    .catch(reject);
            }, 1000);
        });
    }

    protected async launchEventLive(): Promise<void> {
        const writing = async () => {
            try {
                await this.ok();
                await this.writeLockFile();
            } catch (error) {
                console.error(error); // You can handle the error however you need to here.
            }
            setTimeout(writing, 1000);
        }
        writing().catch(()=>{});
    }

    protected async started(): Promise<void> {
        return this.ok();
    }

    protected async ok(): Promise<void> {

    }

    protected async shutdown(): Promise<void> {

    }
}
