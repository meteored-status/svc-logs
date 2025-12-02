import fs from "node:fs/promises";

import {Configuracion} from "./utiles/config";
import {formatMemoria, formatTiempo, info} from "./utiles/log";
import {exists, isDir, readDir} from "./utiles/fs";

export interface IEngine {
    build: (configuracion: Configuracion, unix: number)=>Promise<EngineBase>
}

export type TAbort = (motivo?: string)=>void;

export class EngineBase<T extends Configuracion=Configuracion> {
    /* STATIC */
    public static async build(configuracion: Configuracion, unix: number): Promise<EngineBase> {
        if (await isDir("files/credenciales")) {
            const files = await readDir("files/credenciales");
            for (const file of files) {
                if (file.startsWith(".")) {
                    const current = `files/credenciales/${file}`;
                    if (await isDir(current)) {
                        for (const file of await readDir(current)) {
                            const target = `files/credenciales/${file}`;
                            if (!await exists(target)) {
                                await fs.symlink(`${current}/${file}`, target);
                            }
                        }
                    }
                }
            }

        }
        await this.prebuild(configuracion);

        return this.construir(configuracion, unix);
    }

    protected static async prebuild(configuracion: Configuracion): Promise<void> {
        // Placeholder for pre-build steps
    }

    protected static construir(configuracion: Configuracion, unix: number): EngineBase {
        return new this(configuracion, unix);
    }

    /* INSTANCE */
    private abortController: AbortController;

    public get abortSignal(): AbortSignal {
        return this.abortController.signal;
    }

    protected constructor(protected readonly configuracion: T, public readonly inicio: number) {
        this.abortController = new AbortController();
    }

    public abort(motivo?: string): void {
        this.abortController.abort(motivo);
    }

    public async master(): Promise<void> {
        // this.usoTiempo();
        this.initMaster();
    }

    public async ejecutar(): Promise<void> {
        // this.usoTiempo();
        this.init();
    }

    protected initMaster(): void {
        // Placeholder for master initialization
    }

    protected init(): void {
        // Placeholder for initialization
    }

    protected usoMemoria(): void {
        const memoria = process.memoryUsage();
        info(`Uso de memoria:`);
        info(`- Heap:    ${formatMemoria(memoria.heapUsed)}/${formatMemoria(memoria.heapTotal)}`);
        if (memoria.arrayBuffers) {
            info(`- Buffers: ${formatMemoria(memoria.arrayBuffers)}`);
        }
        info(`- Externa: ${formatMemoria(memoria.external)}`);
        info(`- RSS:     ${formatMemoria(memoria.rss)}`);
    }

    protected usoTiempo(): void {
        info(`Tiempo de ejecución: ${formatTiempo(Date.now()-this.inicio)}`);
    }

    protected async eventReady(): Promise<void> {
        // Placeholder for ready event
    }

    protected async eventLive(): Promise<void> {
        // Placeholder for live event
    }
}
