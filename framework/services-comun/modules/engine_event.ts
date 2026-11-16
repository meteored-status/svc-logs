/**
 * Editor: Bixus
 * Fecha: Fri, 13 Nov 2026 08:17:27 GMT
 * Hash: 9bd16a8b2d935058012e45697f28e380
 * Versión: 2026.11.13+1-bixus
 * Anterior: 2026.9.23+3-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

import chokidar from "chokidar";

import type {Configuracion} from "@mr/core-workload/config";
import {Engine as EngineBase} from "@mr/core-workload/engine";

import {isDir, mkdir, safeWrite} from "./utiles/fs";
import {info} from "./utiles/log";
import {PromiseDelayed} from "./utiles/promise";

export abstract class EngineEvent<T extends Configuracion=Configuracion> extends EngineBase<T> {
    /* INSTANCE */
    // protected constructor(configuracion: T, inicio: number) {
    //     super(configuracion, inicio);
    // }

    protected override async init(): Promise<void> {
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
                    void this.solicitarApagado("Se ha solicitado el apagado del POD");
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

    protected override async shutdown(): Promise<void> {

    }
}
