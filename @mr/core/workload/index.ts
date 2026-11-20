/**
 * Editor: Bixus
 * Fecha: Fri, 20 Nov 2026 08:56:10 GMT
 * Hash: e355eac222a6dd9c53434ba582f11792
 * Versión: 2026.11.20+1-bixus
 * Anterior: 2026.11.13+1-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

import cluster, {type Worker} from "node:cluster";
import emitter from "node:events";
import http from "node:http";
import os from "node:os";

import {ManifestDeploymentKind} from "@mr/core-dev/manifest/deployment";
import {Deferred, PromiseDelayed} from "services-comun/modules/utiles/promise";
import {error, info, warning} from "services-comun/modules/utiles/log";

import {comprobarEmuladorPubSub, modoPubSub} from "./config/pubsub";
import type {Configuracion} from "./config";
import type {Engine} from "./engine";
import {type IPodInfo, crearPodInfo} from "./config/pod";
import {type IHeartbeatCreado, type TModoHeartbeat, iniciarHeartbeat} from "./heartbeat/crear";
import {type IWorkerCierre, instalarCierrePrimario} from "./heartbeat/cierre-primario";
import {type IResultadoDespedida, PRIMER_ENVIO_ESPERA_MAX_MS} from "./heartbeat/emisor";
import {esperarPrimerEnvio, resultadoDeError, terminarEjecucionFinita} from "./heartbeat/finita";
import {esMensajeHeartbeatWorker} from "./heartbeat/workers";
import {borrarLockApagado} from "./engine/lock";
import {instalarApagado} from "./engine/apagado";
import {pararSidecar} from "./engine/sidecar";

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
 *    Después, arrancar el heartbeat de pods si el servicio lo tiene activado (ver `heartbeat/` y el README).
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
     * - Si es un **cronjob**, despide el heartbeat (resultado `error` con `err.name`, si lo hay) y detiene el sidecar antes de salir
     *   con código `0` ({@link Main.terminarEjecucionFinita}).
     * - En cualquier otro caso, finaliza el proceso con código `1`. Antes espera como mucho 1 s a que salga el primer latido del
     *   heartbeat (`arrancando`), para que el receptor vea el arranque fallido y cuente el reinicio; no cambia el código de salida.
     *   Si el manifiesto es de un cronjob o job que aún no se había declarado como tal, para además el sidecar
     *   ({@link Main.pararSidecarSiFinita}).
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
                // todo tener en cuenta el lambda
                await main.terminarEjecucionFinita(resultadoDeError(err));
            } else {
                await main.esperarPrimerEnvio();
                await main.pararSidecarSiFinita();
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
    private pod: IPodInfo|null;
    private heartbeat: IHeartbeatCreado|null;
    private engineActual: Engine|null;
    private ejecucionFinitaPendiente: boolean;
    private finitaPorManifest: boolean;
    protected cronjob: boolean;

    /**
     * Cómo corre este proceso a efectos del heartbeat: uno por pod, no uno por worker.
     */
    private get modoHeartbeat(): TModoHeartbeat {
        if (!this.isClusterMode) {
            return "simple";
        }

        return cluster.isPrimary ? "primario" : "worker";
    }

    protected constructor(engine: IEngine, configLoader: IConfiguracionLoader, {minimo_hilos: minimoHilos = 1}: IMainConfig = {}) {
        this.engine = engine;
        this.configLoader = configLoader;
        this.unix = Date.now();
        this.minimoHilos = minimoHilos;
        this.slaves = new Map<Worker, ClusterStatus>();
        this.pod = null;
        this.heartbeat = null;
        this.engineActual = null;
        this.ejecucionFinitaPendiente = false;
        this.finitaPorManifest = false;
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
     * Solicita al sidecar de Istio su parada graceful mediante `POST /quitquitquit` ({@link pararSidecar}): como mucho
     * `PARADA_SIDECAR_MAX_MS` (2 s) de espera, y los errores de red se ignoran porque el proceso puede estar ya en fase de cierre.
     * Si `pod.sidecar` es `false`, retorna inmediatamente sin hacer ninguna petición.
     *
     * @param options     - Opciones del método.
     * @param options.pod - Información del pod. Si no se proporciona, se asume que el sidecar está activo.
     */
    public async stopSidecar({pod}: {pod?: IPodInfo} = {}): Promise<void> {
        if (!(pod?.sidecar ?? true)) {
            return;
        }

        await pararSidecar();
    }

    /**
     * Final de una carga finita (cronjob o job): despide el heartbeat con el resultado de la ejecución (si el pod emite), detiene el
     * sidecar de Istio y sale con código 0, en ese orden (ver {@link terminarEjecucionFinita}).
     *
     * @param ejecucion - Cómo acabó la ejecución.
     */
    protected async terminarEjecucionFinita(ejecucion: IResultadoDespedida): Promise<void> {
        await terminarEjecucionFinita({
            emisor: this.heartbeat?.emisor ?? null,
            ejecucion,
            stopSidecar: async ()=>this.stopSidecar({pod: this.pod ?? undefined}),
            salir: (codigo)=>{
                info("Proceso terminado");
                process.exit(codigo);
            },
        });
    }

    /**
     * Deja salir el primer latido antes de que un arranque fallido termine el proceso (como mucho {@link PRIMER_ENVIO_ESPERA_MAX_MS}).
     * Sin heartbeat no hace nada. Nunca rechaza.
     */
    protected async esperarPrimerEnvio(): Promise<void> {
        await esperarPrimerEnvio(this.heartbeat?.emisor ?? null, PRIMER_ENVIO_ESPERA_MAX_MS);
    }

    /**
     * Un cronjob o job que falla antes de declararse como tal (cargando la configuración o esperando al sidecar) sale por el camino de
     * servicio, con código `1`; sin parar el sidecar, `istio-proxy` seguiría vivo y el pod se quedaría en `Running` con el Job colgado
     * (con `Forbid`, saltándose las siguientes ejecuciones) hasta `activeDeadlineSeconds`. Solo el proceso del pod (simple o primario),
     * nunca un worker. Nunca rechaza.
     */
    protected async pararSidecarSiFinita(): Promise<void> {
        if (!this.finitaPorManifest || (this.isClusterMode && !cluster.isPrimary)) {
            return;
        }
        await this.stopSidecar({pod: this.pod ?? undefined});
    }

    /**
     * Los workers del primario, vistos como los necesita el cierre del heartbeat.
     */
    private workersParaCierre(): IWorkerCierre[] {
        return [...this.slaves.keys()].map((worker)=>({
            haSalido: ()=>worker.isDead(),
            alSalir: (cb)=>{ worker.once("exit", ()=>{ cb(); }); },
            enviarSenal: (senal)=>{ worker.process.kill(senal); },
        }));
    }

    /**
     * Levanta un worker y registra su ciclo básico de mensajes.
     */
    private addSlave(): void {
        const worker = cluster.fork();
        this.slaves.set(worker, ClusterStatus.RUNNING);
        this.heartbeat?.workers?.alta(worker.id, Date.now());
        worker.on("exit", ()=>{
            this.heartbeat?.workers?.baja(worker.id);
            this.heartbeat?.instancia.disparar();
        });
        worker.on("message", (message)=>{
            if (typeof message !== "object" || message === null) {
                return;
            }
            switch (message.cmd) {
                case "spawn":
                    this.addSlave();
                    break;
                case "heartbeat":
                    if (esMensajeHeartbeatWorker(message) && this.heartbeat?.workers?.informe(worker.id, message, Date.now())) {
                        this.heartbeat.instancia.disparar();
                    }
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
        this.engineActual = engineInstance;
        this.heartbeat?.instancia.setEngine(engineInstance);
        await engineInstance.ejecutar();
        this.heartbeat?.instancia.marcarEjecutado();
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
     * 1. Comprueba que `PUBSUB_EMULATOR_HOST` no esté definida en un bundle de test o producción (`comprobarEmuladorPubSub`):
     *    si lo está, el arranque aborta. Si el proceso corre contra el emulador, lo deja en el log (solo el primario).
     * 2. Lee los metadatos del pod (`crearPodInfo`) y arranca el heartbeat si el servicio lo tiene activado, en `arrancando`: así un
     *    proceso que muere cargando la configuración o esperando al sidecar ya deja su latido (ver {@link Main.ejecutar}).
     * 3. Carga la configuración (single-shot).
     * 4. Espera al sidecar.
     * 5. En modo cluster: primario → `startMaster`; worker → `startSlave`.
     * 6. En modo simple: `build → master → ejecutar`. Si es cronjob, despide el heartbeat con el resultado (`ok`, o `error` si falló
     *    `master()`; si `ejecutar()` rechaza, lo hace `Main.ejecutar`), detiene el sidecar y termina.
     */
    protected async start(): Promise<void> {
        comprobarEmuladorPubSub({produccion: PRODUCCION, env: process.env});
        if (!this.isClusterMode || !cluster.isPrimary) {
            // Sin esto, `SIGTERM` mataba el proceso al instante salvo que el servidor HTTP la atendiera. El primario de un
            // cluster lleva su propio manejador (`instalarCierrePrimario`).
            instalarApagado({estado: ()=>({engine: this.engineActual, ejecucionPendiente: this.ejecucionFinitaPendiente, emisor: this.heartbeat?.emisor ?? null})});
        }
        const {emulador, proyecto} = modoPubSub(process.env);
        if (emulador !== null && cluster.isPrimary) {
            info(`Pub/Sub: emulador ${emulador} (${proyecto})`);
        }

        // El heartbeat arranca antes de cargar la configuración y de esperar al sidecar: un proceso que muere ahí también deja su `arrancando`
        // (el sidecar ya está listo cuando arranca la app, `holdApplicationUntilProxyStarts`). Solo usa el entorno, `package.json` y `mrpack.json`.
        const podInicial = await crearPodInfo();
        // Se sabe ya si es una carga finita: si el arranque falla antes de declararla, el sidecar también hay que pararlo.
        this.pod = podInicial;
        this.finitaPorManifest = podInicial.cronjob;
        this.heartbeat = iniciarHeartbeat({pod: podInicial, unix: this.unix, modo: this.modoHeartbeat});

        const configuracion = await this.configLoader.load();
        this.configLoader.load = () => { throw new Error("Solo se puede cargar la configuración una vez"); };

        this.pod = configuracion.pod;
        await this.startSidecar(configuracion.pod);

        // Un `shutdown.lock` que sobreviva a un reinicio del contenedor (el `emptyDir` es del pod) apagaría el nuevo al arrancar. Se borra
        // **una sola vez por proceso de pod** (modo simple o primario, antes de forkear): si lo borrara cada worker, el que arrancase tarde
        // se llevaría por delante un lock legítimo de un pod que ya está terminando y no drenaría.
        if (!this.isClusterMode || cluster.isPrimary) {
            await borrarLockApagado();
        }

        const emisor = this.heartbeat?.emisor ?? null;
        if (this.isClusterMode && cluster.isPrimary) {
            // Con o sin heartbeat: el primario reenvía la señal a los workers y espera a que salgan; con él, además despide el pod.
            instalarCierrePrimario({workers: ()=>this.workersParaCierre(), emisor});
        }

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
        this.engineActual = engineInstance;
        // Cronjob o job: `master()` + `ejecutar()` son el trabajo entero y el proceso acaba cuando terminan, no por la señal
        // (una señal durante `master()` saldría con 0 y el Job constaría como correcto).
        const finita = configuracion.pod.cronjob || configuracion.pod.tipo === ManifestDeploymentKind.JOB;
        this.ejecucionFinitaPendiente = finita;
        let ejecucion: IResultadoDespedida = {resultado: "ok", error: null};
        if (finita) {
            // En una carga finita el pod está en curso desde que tiene engine, no desde que `ejecutar()` resuelve (que es el final).
            this.heartbeat?.instancia.setEngine(engineInstance);
        }
        try {
            try {
                await engineInstance.master();
            } catch (err) {
                error("Error iniciando el Master Engine", err);
                // Se sigue ejecutando como siempre, pero la ejecución consta como fallida.
                ejecucion = resultadoDeError(err);
            }
            if (!finita) {
                this.heartbeat?.instancia.setEngine(engineInstance);
            }
            await engineInstance.ejecutar();
        } finally {
            this.ejecucionFinitaPendiente = false;
        }
        this.heartbeat?.instancia.marcarEjecutado();
        if (configuracion.pod.cronjob) {
            await this.terminarEjecucionFinita(ejecucion);
        } else {
            this.setupWarningHandler();
        }
    }
}
