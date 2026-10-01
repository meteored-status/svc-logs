/**
 * Editor: Bixus
 * Fecha: Wed, 23 Sep 2026 08:46:25 GMT
 * Hash: b5b00d33aceae63d5d1b5075efefd517
 * Versión: 2026.9.23+3-bixus
 * Anterior: 2026.6.17+3-josantoniojimnez
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
                    this.abort("Se ha solicitado el apagado del POD");
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
