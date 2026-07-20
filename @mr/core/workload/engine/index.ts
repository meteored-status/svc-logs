/**
 * Editor: José Antonio Jiménez
 * Fecha: Wed, 17 Jun 2026 11:12:28 GMT
 * Hash: c0e88622091b77956470d43d0535595d
 * Versión: 2026.6.17+1-josantoniojimnez
 */

import fs from "node:fs/promises";

import {formatMemoria, formatTiempo, info} from "services-comun/modules/utiles/log";
import {exists, isDir, mkdir, readDir} from "services-comun/modules/utiles/fs";

import type {Configuracion} from "../config";

/**
 * Función de cancelación que puede llamarse desde cualquier punto del código para
 * abortar las operaciones en curso del engine. El parámetro `motivo` se propaga
 * al {@link AbortSignal} expuesto por {@link Engine.abortSignal}.
 */
export type TAbort = (motivo?: string)=>void;

/**
 * Lado estático requerido por `build` para subclases de {@link Engine}.
 *
 * Describe los métodos estáticos que toda subclase debe exponer para que el método
 * polimórfico `build` pueda invocarlos correctamente con tipado seguro.
 */
type TEngineStatic<TConfig extends Configuracion, TEngine extends Engine<TConfig>> = {
    prebuild(configuracion: TConfig): Promise<void>;
    construir(configuracion: TConfig, unix: number): TEngine;
};

/**
 * Constructor tipado para instancias de {@link Engine} y subclases.
 *
 * Combina la firma `new (...)` con los métodos estáticos de {@link TEngineStatic}
 * para permitir la factoría polimórfica de `build`.
 */
type TEngineCtor<TConfig extends Configuracion, TEngine extends Engine<TConfig>> = (new (configuracion: TConfig, inicio: number)=>TEngine) & TEngineStatic<TConfig, TEngine>;

/**
 * Clase base para todos los motores de ejecución del monorepo.
 *
 * Define el contrato mínimo de construcción y ciclo de vida:
 *
 * ```
 * Engine.build(config, unix)
 *   → syncCredenciales()    — symlinks en files/credenciales/
 *   → prebuild(config)      — hook estático sobreescribible
 *   → construir(config)     — new this(config, unix)
 *          │
 *          ▼
 * engine.master()  →  initMaster()   — lógica del proceso primario (cluster)
 * engine.ejecutar() → init()         — lógica principal de arranque
 * ```
 *
 * Las subclases sobreescriben `init()` y opcionalmente `initMaster()`, `prebuild()` y `construir()`.
 *
 * @template T - Tipo concreto de configuración; debe extender {@link Configuracion}.
 */
export class Engine<T extends Configuracion=Configuracion> {
    /* STATIC */

    /**
     * Factoría principal del engine.
     *
     * Ejecuta, en orden:
     * 1. {@link syncCredenciales} — prepara symlinks de credenciales.
     * 2. {@link prebuild} — hook estático para configuración previa.
     * 3. {@link construir} — instancia el engine concreto.
     *
     * Es polimórfico: invocado desde una subclase devuelve el tipo de esa subclase.
     *
     * @param configuracion - Configuración tipada del engine.
     * @param unix          - Timestamp de arranque (`Date.now()` tomado por {@link Main} una sola vez).
     */
    public static async build<TConfig extends Configuracion, TEngine extends Engine<TConfig>>(this: TEngineCtor<TConfig, TEngine>, configuracion: TConfig, unix: number): Promise<TEngine> {
        await Engine.syncCredenciales();
        await this.prebuild(configuracion);

        return this.construir(configuracion, unix);
    }

    /**
     * Sincroniza las credenciales del pod creando symlinks planos en
     * `files/credenciales/` que apuntan a los ficheros agrupados por carpeta en
     * `files/.credenciales/<dir>/`.
     *
     * Sólo actúa si `files/.credenciales/` existe (entorno k8s en producción con secrets
     * montados como volumen). Los errores `EEXIST` se ignoran (symlink ya creado).
     */
    private static async syncCredenciales(): Promise<void> {
        if (await isDir("/usr/src/app/files/.credenciales")) {
            if (!await isDir("/usr/src/app/files/credenciales")) {
                await mkdir("/usr/src/app/files/credenciales", true);
            }
            const dirs = await readDir("/usr/src/app/files/.credenciales");
            for (const dir of dirs) {
                const current = `/usr/src/app/files/.credenciales/${dir}`;
                if (await isDir(current)) {
                    for (const file of await readDir(current)) {
                        const target = `/usr/src/app/files/credenciales/${file}`;
                        if (!await exists(target)) {
                            try {
                                await fs.symlink(`../.credenciales/${dir}/${file}`, target);
                            } catch (err) {
                                if (!(err instanceof Error) || (err as NodeJS.ErrnoException).code !== "EEXIST") {
                                    throw err;
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    /**
     * Hook estático invocado por {@link build} justo antes de construir la instancia.
     * La implementación base es un no-op; las subclases lo sobreescriben para
     * ejecutar lógica global de configuración (p.ej. fijar variables estáticas de
     * {@link Respuesta} con los metadatos del pod).
     *
     * @param configuracion - Configuración ya resuelta del servicio.
     */
    protected static async prebuild<TConfig extends Configuracion>(configuracion: TConfig): Promise<void> {
        void configuracion;
        // Placeholder for pre-build steps
    }

    /**
     * Instancia el engine concreto mediante `new this(configuracion, unix)`.
     * Puede sobreescribirse en subclases para aplicar pasos adicionales de
     * inicialización síncrona antes de devolver la instancia.
     *
     * @param configuracion - Configuración del engine.
     * @param unix          - Timestamp de arranque en milisegundos.
     */
    protected static construir<TConfig extends Configuracion, TEngine extends Engine<TConfig>>(this: TEngineCtor<TConfig, TEngine>, configuracion: TConfig, unix: number): TEngine {
        return new this(configuracion, unix);
    }

    /* INSTANCE */

    private abortController: AbortController;

    /**
     * Señal de cancelación que pueden observar operaciones asíncronas largas.
     * Se activa llamando a {@link abort}.
     */
    public get abortSignal(): AbortSignal {
        return this.abortController.signal;
    }

    /**
     * @param configuracion - Configuración tipada de la instancia (readonly, accesible en subclases).
     * @param inicio        - Timestamp de arranque en milisegundos (readonly, usado por {@link usoTiempo}).
     */
    protected constructor(protected readonly configuracion: T, public readonly inicio: number) {
        this.abortController = new AbortController();
    }

    /**
     * Activa el {@link AbortController} interno para cancelar operaciones en curso.
     * Propaga `motivo` como razón de aborto al {@link AbortSignal}.
     *
     * @param motivo - Descripción opcional del motivo de cancelación.
     */
    public abort(motivo?: string): void {
        this.abortController.abort(motivo);
    }

    /**
     * Punto de entrada para la ejecución en modo **master** (proceso primario en cluster).
     * Delega en {@link initMaster}, que las subclases sobreescriben para lógica de master.
     */
    public async master(): Promise<void> {
        // this.usoTiempo();
        await this.initMaster();
    }

    /**
     * Punto de entrada para la ejecución estándar del engine (modo simple o worker en cluster).
     * Delega en {@link init}, que las subclases sobreescriben para la lógica principal.
     */
    public async ejecutar(): Promise<void> {
        // this.usoTiempo();
        await this.init();
    }

    /**
     * Hook de inicialización en modo master. No-op en la clase base.
     * Las subclases lo sobreescriben cuando necesitan lógica exclusiva del proceso primario
     * en un despliegue cluster (p.ej. precarga de datos, comprobaciones globales).
     */
    protected async initMaster(): Promise<void> {
        // Placeholder for master initialization
    }

    /**
     * Hook de inicialización estándar. No-op en la clase base.
     * Las subclases **deben** sobreescribirlo para implementar la lógica principal de arranque
     * (arranque del servidor HTTP, conexiones a BD, suscripciones, etc.).
     */
    protected async init(): Promise<void> {
        // Placeholder for initialization
    }

    /**
     * Registra en el log el consumo de memoria del proceso Node.js en el momento
     * de la llamada: heap usado/total, ArrayBuffers externos y RSS.
     */
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

    /**
     * Registra en el log el tiempo transcurrido desde {@link inicio} hasta ahora,
     * formateado de forma legible (ms, s, min…).
     */
    protected usoTiempo(): void {
        info(`Tiempo de ejecución: ${formatTiempo(Date.now()-this.inicio)}`);
    }
}
