/**
 * Editor: José Antonio Jiménez
 * Fecha: Wed, 17 Jun 2026 11:12:28 GMT
 * Hash: f99c7c9639f07701f7f59b3975bd000f
 * Versión: 2026.6.17+1-josantoniojimnez
 */

import cluster, {type Worker} from "node:cluster";
import emitter from "node:events";
import http from "node:http";
import os from "node:os";

import {Deferred, PromiseDelayed} from "services-comun/modules/utiles/promise";
import {error, info, warning} from "services-comun/modules/utiles/log";

import type {Configuracion} from "./config";
import type {Engine} from "./engine";
import type {IPodInfo} from "./config/pod";

emitter.setMaxListeners(256);

/**
 * Contrato mínimo del motor de ejecución que cada servicio debe implementar.
 *
 * La clase de engine de cada servicio debe ofrecer un método estático `build` que
 * instancie y configure el engine a partir de la configuración cargada y el timestamp
 * de arranque `unix`. Este método es llamado por {@link Main} justo antes de iniciar
 * el ciclo de vida (`master` → `ejecutar`).
 *
 * @template T - Tipo concreto de configuración; por defecto {@link Configuracion}.
 *
 * @property build - Factoría asíncrona: recibe la configuración resuelta y el timestamp
 *   de arranque (`Date.now()` tomado una sola vez por {@link Main}) y devuelve la
 *   instancia del engine ya preparada.
 *
 * @example
 * ```ts
 * class MiEngine extends Engine<MiConfig> {
 *     public static override async build(configuracion: MiConfig, unix: number): Promise<MiEngine> {
 *         // inicialización...
 *         return new this(configuracion, unix);
 *     }
 * }
 * ```
 */
export interface IEngine<T extends Configuracion=Configuracion> {
    build: (configuracion: Configuracion, unix: number)=>Promise<Engine<T>>
}

/**
 * Contrato de carga de configuración compatible con {@link Configuracion} de
 * `@mr/core-workload/config`.
 *
 * Las clases de configuración de cada servicio lo satisfacen exponiendo su método
 * estático `load()` que lee `files/config.json`, resuelve la información del pod y
 * devuelve la instancia ya construida.
 *
 * Se usa como segundo argumento de {@link Main.ejecutar}:
 *
 * ```ts
 * type TConfigLoader = Parameters<typeof Main.ejecutar>[1];
 * Main.ejecutar(MiEngine, MiConfiguracion as TConfigLoader);
 * ```
 *
 * @property load - Carga la configuración del servicio una única vez. Tras la primera
 *   llamada, {@link Main} sobreescribe esta propiedad para lanzar un error si se
 *   intenta volver a invocar.
 */
export interface IConfiguracionLoader {
    load: ()=>Promise<Configuracion>;
}

enum ClusterStatus {
    RUNNING,
    STOPPED,
}

/**
 * Configuración opcional que se puede pasar a {@link Main.ejecutar} para controlar
 * el modo de arranque del runtime.
 *
 * @property minimo_hilos - Número mínimo de hilos de ejecución.
 *   - `1` (por defecto): modo simple; el proceso primario ejecuta directamente el engine.
 *   - `> 1`: modo cluster; se levantan `N` workers y el primario actúa como master.
 *   - `< 1`: modo cluster con `os.availableParallelism()` workers.
 */
export interface IMainConfig {
    minimo_hilos?: number;
}

/**
 * Orquestador central del ciclo de arranque de cualquier servicio del monorepo.
 *
 * Responsabilidades:
 * 1. Cargar la configuración del servicio (una sola vez) a través de {@link IConfiguracionLoader}.
 * 2. Esperar a que el sidecar de Istio esté operativo (`/healthz/ready`).
 * 3. Elegir el modo de ejecución:
 *    - **Modo simple** (`minimo_hilos === 1`): ejecuta `build → master → ejecutar` en el proceso actual.
 *    - **Modo cluster** (`minimo_hilos !== 1`): el proceso primario ejecuta `master` y levanta N workers; cada worker ejecuta `ejecutar`.
 * 4. Si el servicio es un cronjob, detener el sidecar y finalizar el proceso al terminar.
 *
 * ### Uso típico
 *
 * ```ts
 * // main.ts de un servicio
 * import {Main} from "@mr/core-workload";
 * import {Engine} from "./modules/engine";
 * import {Configuracion} from "./modules/utiles/config";
 *
 * type TConfigLoader = Parameters<typeof Main.ejecutar>[1];
 * Main.ejecutar(Engine, Configuracion as TConfigLoader);
 * ```
 */
export class Main {
    /* STATIC */

    /**
     * Punto de entrada público del runtime. Instancia {@link Main} y dispara el ciclo
     * de arranque de forma asíncrona.
     *
     * En caso de error durante el arranque:
     * - Si es un **cronjob**, intenta detener el sidecar antes de salir con código `0`.
     * - En cualquier otro caso, finaliza el proceso con código `1`.
     *
     * @param engine       - Clase del engine del servicio; debe satisfacer {@link IEngine}.
     * @param configLoader - Clase o objeto con el método estático/de instancia `load()`.
     * @param cfg          - Configuración opcional del runtime (ver {@link IMainConfig}).
     */
    public static ejecutar(engine: IEngine, configLoader: IConfiguracionLoader, cfg: IMainConfig = {}): void {
        const main = new this(engine, configLoader, cfg);
        void main.start().catch(async (err)=>{
            error("Error iniciando el Engine", err);
            if (main.cronjob) {
                try {
                    // todo tener en cuenta el lambda
                    await main.stopSidecar();
                } finally {
                    process.exit(0);
                }
            } else {
                process.exit(1);
            }
        });
    }

    /* INSTANCE */
    protected readonly engine: IEngine;
    protected readonly configLoader: IConfiguracionLoader;
    protected readonly unix: number;
    private readonly minimoHilos: number;
    private readonly slaves: Map<Worker, ClusterStatus>;
    protected cronjob: boolean;

    protected constructor(engine: IEngine, configLoader: IConfiguracionLoader, {minimo_hilos = 1}: IMainConfig = {}) {
        this.engine = engine;
        this.configLoader = configLoader;
        this.unix = Date.now();
        this.minimoHilos = minimo_hilos;
        this.slaves = new Map<Worker, ClusterStatus>();
        this.cronjob = false;
    }

    private get isClusterMode(): boolean {
        return this.minimoHilos !== 1;
    }

    /**
     * Comprueba el estado del sidecar de Istio.
     */
    private async checkSidecar(): Promise<void> {
        const deferred = new Deferred<void>();
        let resuelto = false;
        const conexion = http.get("http://localhost:15020/healthz/ready", (message)=>{
            message.on("error", ()=>undefined);
            message.on("end", ()=>undefined);
            if (!resuelto) {
                resuelto = true;
                if (message.statusCode === 200) {
                    deferred.resolve();
                } else {
                    deferred.reject(new Error(message.statusMessage ?? `Status ${message.statusCode ?? "desconocido"}`));
                }
            }
        });
        conexion.on("error", (err)=>{
            if (!resuelto) {
                resuelto = true;
                deferred.reject(err);
            }
        });
        return deferred.promise;
    }

    /**
     * Solicita al sidecar de Istio su parada graceful mediante `POST /quitquitquit`.
     * Los errores de red se ignoran porque el proceso puede estar ya en fase de cierre.
     * Si `pod.sidecar` es `false`, retorna inmediatamente sin hacer ninguna petición.
     *
     * @param options     - Opciones del método.
     * @param options.pod - Información del pod. Si no se proporciona, se asume que el sidecar está activo.
     */
    public async stopSidecar({pod}: {pod?: IPodInfo} = {}): Promise<void> {
        if (!(pod?.sidecar ?? true)) {
            return;
        }

        const deferred = new Deferred<void>();
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
                deferred.resolve();
            }
        });

        conexion.on("error", ()=>{
            if (!resuelto) {
                resuelto = true;
                deferred.resolve();
            }
        });

        conexion.end();
        await deferred.promise;
    }

    /**
     * Levanta un worker y registra su ciclo básico de mensajes.
     */
    private addSlave(): void {
        const worker = cluster.fork();
        this.slaves.set(worker, ClusterStatus.RUNNING);
        worker.on("message", (message)=>{
            if (typeof message !== "object" || message === null) {
                return;
            }
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

    /**
     * Arranque del proceso primario en modo cluster.
     */
    private async startMaster(configuracion: Configuracion, hilos: number): Promise<void> {
        info("Iniciando Engine");
        const engineInstance = await this.engine.build(configuracion, this.unix);
        try {
            await engineInstance.master();
        } catch (err) {
            error("Error iniciando el Master Engine", err);
        }
        for (let i = 0; i < hilos; i++) {
            this.addSlave();
        }
    }

    /**
     * Arranque de un proceso worker en modo cluster.
     */
    private async startSlave(configuracion: Configuracion): Promise<void> {
        info("Iniciando Worker");
        const engineInstance = await this.engine.build(configuracion, this.unix);
        await engineInstance.ejecutar();
    }

    private setupWarningHandler(): void {
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

    /**
     * Espera a que el sidecar de Istio esté operativo consultando `GET /healthz/ready`.
     * Reintenta hasta 10 veces con un retardo creciente de `intento × 100 ms`.
     * Si `pod.sidecar` es `false`, retorna inmediatamente.
     *
     * @param pod - Información del pod, usada para comprobar si el sidecar está habilitado.
     */
    protected async startSidecar(pod: IPodInfo): Promise<void> {
        if (!pod.sidecar) {
            return;
        }

        let intentos = 0;
        let ok = false;
        while (!ok && intentos <= 10) {
            intentos++;
            try {
                await this.checkSidecar();
                ok = true;
            } catch {
                await PromiseDelayed(intentos * 100);
            }
        }
    }

    /**
     * Ejecuta el ciclo completo de arranque:
     * 1. Carga la configuración (single-shot).
     * 2. Espera al sidecar.
     * 3. En modo cluster: primario → `startMaster`; worker → `startSlave`.
     * 4. En modo simple: `build → master → ejecutar`. Si es cronjob, detiene el sidecar y termina.
     */
    protected async start(): Promise<void> {
        const configuracion = await this.configLoader.load();
        this.configLoader.load = () => { throw new Error("Solo se puede cargar la configuración una vez"); };

        await this.startSidecar(configuracion.pod);

        if (this.isClusterMode) {
            this.cronjob = false;
            if (cluster.isPrimary) {
                const hilos = this.minimoHilos < 1 ? os.availableParallelism() : this.minimoHilos;
                await this.startMaster(configuracion, hilos);
            } else {
                await this.startSlave(configuracion);
            }
            this.setupWarningHandler();
            return;
        }

        info("Iniciando Engine");

        this.cronjob = configuracion.pod.cronjob;
        const engineInstance = await this.engine.build(configuracion, this.unix);
        try {
            await engineInstance.master();
        } catch (err) {
            error("Error iniciando el Master Engine", err);
        }
        await engineInstance.ejecutar();
        if (configuracion.pod.cronjob) {
            await this.stopSidecar({pod: configuracion.pod});
            info("Proceso terminado");
            process.exit();
        } else {
            this.setupWarningHandler();
        }
    }
}
