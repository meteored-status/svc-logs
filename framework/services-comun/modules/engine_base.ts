import {Configuracion} from "./utiles/config";
import {formatMemoria, formatTiempo, info} from "./utiles/log";

export interface IEngine {
    build: (configuracion: Configuracion, unix: number)=>Promise<EngineBase>
}

export type TAbort = (motivo?: string)=>void;

export class EngineBase<T extends Configuracion=Configuracion> {
    /* STATIC */
    public static async build(configuracion: Configuracion, unix: number): Promise<EngineBase> {
        await this.prebuild(configuracion);

        return this.construir(configuracion, unix);
    }

    protected static async prebuild(configuracion: Configuracion): Promise<void> {

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

    public async ejecutar(): Promise<void> {
        // this.usoTiempo();
        this.init();
    }

    protected init(): void {

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

    }

    protected async eventLive(): Promise<void> {

    }
}
