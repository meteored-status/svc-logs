/**
 * Editor: Bixus
 * Fecha: Sat, 18 Jul 2026 19:01:45 GMT
 * Hash: 082166b7aa582f8672b684449fdba678
 * Versión: 2026.7.18+1-bixus
 * Anterior: 2026.7.17+1-josantoniojimnez
 * Proyecto: https://github.com/bixus/bixloader
 */

import {spawn, type ChildProcessWithoutNullStreams} from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import chokidar, {type ChokidarOptions} from "chokidar";

import {BuildBundler, BuildFW} from "@mr/core-dev/manifest/build";
import {ManifestDeploymentKind, Runtime} from "@mr/core-dev/manifest/deployment";

import {Colors} from "../colors";
import {getBundlerNormalizado} from "../bundler";
import {type IWorkspace, Workspace} from "../workspace";
import {Log} from "../log";
import {ManifestWorkspaceLoader} from "../manifest/workspace";
import {extractFileRefs, fechaHoraLocal, horaLocal} from "./service-log-utils";

/**
 * Frecuencia de comprobación de actualizaciones de frameworks.
 *
 * - `all`    — comprobar en cada arranque (comportamiento por defecto).
 * - `daily`  — comprobar como máximo una vez al día.
 * - `weekly` — comprobar como máximo una vez a la semana.
 */
export const enum FrameworkUpdates {
    all    = "all",
    daily  = "daily",
    weekly = "weekly",
}

/**
 * Convierte cualquier valor leído de JSON al tipo `FrameworkUpdates`.
 * Si el valor no es uno de los permitidos (`"all"`, `"daily"`, `"weekly"`),
 * devuelve `"all"` como valor por defecto.
 *
 * @param value - Valor leído del fichero de configuración (tipo desconocido).
 * @returns Valor normalizado de `FrameworkUpdates`.
 */
export function sanitizeFrameworkUpdates(value: unknown): FrameworkUpdates {
    if (value === FrameworkUpdates.daily || value === FrameworkUpdates.weekly) {
        return value;
    }
    return FrameworkUpdates.all;
}

/** Grupos de workspaces gestionados en `config.workspaces.json`, según su `deploy.type`. */
export type GrupoWorkspace = "browser" | "cronjobs" | "jobs" | "services";

/**
 * Traduce el `deploy.type` (`ManifestDeploymentKind`) de un workspace al grupo correspondiente
 * de `config.workspaces.json`. Es independiente del directorio físico que lo contiene
 * (`services/`, `cronjobs/`, `jobs/`, `scripts/`): un workspace bajo `scripts/` con
 * `deploy.type: "browser"` se agrupa en `workspaces.browser`.
 *
 * @param tipo - `deploy.type` del workspace.
 * @returns Grupo correspondiente, o `undefined` si el tipo no tiene grupo gestionable (p.ej. `worker`).
 */
export function grupoDeploy(tipo: ManifestDeploymentKind): GrupoWorkspace|undefined {
    switch (tipo) {
        case ManifestDeploymentKind.BROWSER:
            return "browser";
        case ManifestDeploymentKind.CRONJOB:
            return "cronjobs";
        case ManifestDeploymentKind.JOB:
            return "jobs";
        case ManifestDeploymentKind.SERVICE:
            return "services";
        default:
            return undefined;
    }
}

/**
 * Flags de compilación/ejecución de un workspace concreto dentro de `config.workspaces.json`.
 *
 * @property ejecutar - Si `true` (o ausente), el workspace se ejecuta en modo devel. Solo aplica a
 *   workspaces ejecutables (`deploy.runtime === "node"`).
 * @property compilar - Si `true` (o ausente), el workspace se compila. Solo aplica a workspaces
 *   compilables (`deploy.runtime !== "php"`).
 */
export interface IWorkspaceFlags {
    ejecutar?: boolean;
    compilar?: boolean;
}

/**
 * Configuración del workspace de internacionalización (`i18n`) dentro de `config.workspaces.json`.
 *
 * @property enabled - Si `true` (o ausente), se inicia la generación de i18n al arrancar la
 *   compilación. Si `false`, ese paso se omite por completo.
 * @property watch - Si `true`, la generación de i18n permanece observando cambios en los
 *   ficheros de traducción del workspace. Si `false` (o ausente), genera una única vez.
 */
export interface IConfigWorkspacesI18n {
    enabled?: boolean;
    watch?: boolean;
}

/**
 * Workspaces gestionados en `config.workspaces.json`, agrupados por `deploy.type`.
 * Todas las propiedades son opcionales: un grupo sin workspaces gestionables se omite, e
 * `i18n` solo se incluye si el proyecto tiene workspace de internacionalización.
 */
export interface IConfigWorkspaces {
    i18n?: IConfigWorkspacesI18n;
    browser?: Record<string, IWorkspaceFlags>;
    cronjobs?: Record<string, IWorkspaceFlags>;
    jobs?: Record<string, IWorkspaceFlags>;
    services?: Record<string, IWorkspaceFlags>;
}

/**
 * Busca los flags de un workspace por nombre en cualquiera de los grupos de `workspaces`
 * (los nombres de workspace son únicos en todo el monorepo).
 *
 * @param workspaces - `IConfigServices.workspaces`.
 * @param nombre     - Nombre del workspace a buscar.
 * @returns Flags encontrados, o un objeto vacío si el workspace no está configurado.
 */
export function flagsWorkspace(workspaces: IConfigWorkspaces|undefined, nombre: string): IWorkspaceFlags {
    return workspaces?.browser?.[nombre]
        ?? workspaces?.cronjobs?.[nombre]
        ?? workspaces?.jobs?.[nombre]
        ?? workspaces?.services?.[nombre]
        ?? {};
}

/**
 * Configuración personal de workspaces leída de `config.workspaces.json`.
 *
 * @property workspaces - Workspaces gestionados, agrupados por `deploy.type`, con sus flags
 *   `ejecutar`/`compilar`; incluye también `workspaces.i18n` (ver {@link IConfigWorkspacesI18n}).
 * @property framework - Configuración de frameworks: último patch aplicado (`patch`, `RXXX`,
 *   por `yarn run patch:apply`) y política de actualización automática (`updates`).
 */
export interface IConfigServices {
    workspaces?: IConfigWorkspaces;
    framework?: {
        patch?: string;
        updates: FrameworkUpdates;
    };
}

/**
 * Datos de un workspace de tipo servicio.
 *
 * @property pad      - Anchura mínima del nombre para alinear la salida en consola.
 * @property compilar - Si `true`, compila el workspace al arrancar.
 * @property ejecutar - Si `true`, ejecuta el servicio tras compilar.
 * @property forzar   - Si `true`, fuerza la compilación aunque no haya cambios.
 * @property global   - Configuración global de workspaces.
 */
export interface IService extends IWorkspace {
    pad: number;
    compilar: boolean;
    ejecutar: boolean;
    forzar: boolean;
    global: IConfigServices;
}

/**
 * Workspace de tipo servicio ejecutable.
 * Combina compilación (rspack/next) y ejecución del proceso Node con reinicios automáticos,
 * watchers de ficheros y respeto a la configuración global de `config.workspaces.json`.
 *
 * En modo compilación (`-c`), si el workspace declara `build.deps` en su `mrpack.json`,
 * el compilador no arranca hasta que todos los workspaces de los que depende hayan emitido
 * su primera compilación exitosa (señal detectada por patrones en su stdout).
 * Debe llamarse `inicializarDeps()` antes de `init()` para activar esta coordinación.
 */
export class Service extends Workspace {
    /* STATIC */
    private static TIMEOUT = 300000;
    private static COMPILABLES: (Runtime|undefined)[] = [Runtime.node, Runtime.browser, Runtime.cfworker];
    private static PAUSABLES: (BuildFW|undefined)[] = [BuildFW.meteored, BuildFW.nextjs];

    /* INSTANCE */
    private readonly compilar: boolean;
    private readonly ejecutar: boolean;

    private readonly label: string;
    private global_compilar: boolean;
    private global_ejecutar: boolean;
    private config: Promise<ManifestWorkspaceLoader>;

    private compilador?: ChildProcessWithoutNullStreams;
    private ejecucion?: ChildProcessWithoutNullStreams;
    private timeout?: NodeJS.Timeout;

    private readonly compilarListeners: (() => void)[];
    private primeraCompilacionEmitida: boolean;
    private readonly depsPendientes: Set<string>;
    private logCompilarInicio: Promise<void> | undefined;

    public constructor(data: IService) {
        super(data);

        const nombre = data.nombre.padEnd(data.pad);
        const color = Colors.nextColor();

        this.compilar = data.compilar || data.forzar;
        this.ejecutar = data.ejecutar;

        this.label = Colors.colorize(color, nombre);
        const flags = flagsWorkspace(data.global.workspaces, this.nombre);
        this.global_compilar = flags.compilar ?? true;
        this.global_ejecutar = flags.ejecutar ?? true;
        this.config = new ManifestWorkspaceLoader(this.dir).load();
        // Evita un unhandledRejection si `mrpack.json` es inválido al arrancar; el rechazo
        // real se sigue propagando a quien haga `await this.config`.
        this.config.catch(() => undefined);

        this.compilarListeners = [];
        this.primeraCompilacionEmitida = false;
        this.depsPendientes = new Set();
        this.logCompilarInicio = undefined;
    }

    /**
     * Registra un callback que se invocará cuando este servicio emita su primera compilación exitosa.
     * Si ya compiló anteriormente, el callback se invoca de inmediato.
     *
     * @param cb - Función a invocar al detectar la primera compilación exitosa.
     */
    public registrarListenerCompilacion(cb: () => void): void {
        if (this.primeraCompilacionEmitida) {
            cb();
            return;
        }
        this.compilarListeners.push(cb);
    }

    /**
     * Inicializa las dependencias de compilación del workspace leyendo `build.deps` de su `mrpack.json`.
     * Para cada dependencia que vaya a compilar, bloquea el arranque del compilador de este workspace
     * hasta que aquélla emita su primera compilación exitosa.
     *
     * Debe llamarse **antes** de `init()`.
     *
     * @param serviciosPorNombre - Mapa de nombre → instancia de todos los servicios del entorno.
     */
    public async inicializarDeps(serviciosPorNombre: Map<string, Service>): Promise<void> {
        if (!this.compilar) {
            return;
        }
        const {manifest} = await this.config;
        for (const dep of manifest.build.deps) {
            const servicioDep = serviciosPorNombre.get(dep);
            if (servicioDep == undefined) {
                continue;
            }
            if (!await servicioDep.estaListoParaCompilar()) {
                continue;
            }
            this.depsPendientes.add(dep);
            servicioDep.registrarListenerCompilacion(() => {
                this.depResuelta(dep);
            });
        }
    }

    /**
     * Indica si este servicio va a arrancar su compilador en este entorno de desarrollo.
     * Se usa para determinar si los workspaces dependientes deben esperar a este servicio.
     */
    public async estaListoParaCompilar(): Promise<boolean> {
        if (!this.compilar || !this.global_compilar) {
            return false;
        }
        const {manifest: config} = await this.config;
        if (!config.enabled) {
            return false;
        }
        return Service.COMPILABLES.includes(config.deploy.runtime);
    }

    protected override initWatcher(): void {
        this.watcher?.close();
        const options: ChokidarOptions = {
            persistent: true,
            ignored: (path) => path.endsWith("~") || path.includes(`/output/`) || path.includes(`/assets/`) || path.includes(`/files/`) || path.includes(`/.next/`),
            ignoreInitial: true,
            cwd: this.dir,
        };

        const watchFN = (path: string): void => {
            if (path === "mrpack.json") {
                this.updatePackageFile()
                    .then(() => undefined)
                    .catch((err) => {
                        Log.error({
                            type: Log.label_base,
                            label: this.label,
                        }, "Error actualizando scripts tras cambio en mrpack.json", err);
                    });
            } else {
                this.cambio();
            }
        }

        this.watcher = chokidar.watch(".", options)
            .on("add", watchFN)
            .on("change", watchFN)
            .on("unlink", watchFN);
    }

    public override cambio(): void {
        this.runCompilar()
            .then(() => undefined)
            .catch((err) => {
                Log.error({
                    type: Log.label_base,
                    label: this.label,
                }, "Error reiniciando el compilador", err);
            });
        for (const actual of this.hijos) {
            actual.cambio();
        }
    }

    private setTimeoutCompilador(): void {
        // if (os.platform()=="linux") {
        //     return;
        // }
        if (this.timeout!=undefined) {
            clearTimeout(this.timeout);
        }
        this.timeout = setTimeout(()=>{
            this.stopCompilar()
                .then(() => undefined)
                .catch((err) => {
                    Log.error({
                        type: Log.label_base,
                        label: this.label,
                    }, "Error pausando el compilador", err);
                });
        }, Service.TIMEOUT);
    }

    private async updatePackageFile(): Promise<void> {
        const anterior = await this.config;
        const config = new ManifestWorkspaceLoader(this.dir).loadSync();
        const bundlerAnterior = anterior.manifest.build.bundler;
        const bundlerNuevo = getBundlerNormalizado(config.manifest);
        if (bundlerAnterior!==bundlerNuevo && this.compilador!=undefined) {
            Log.info({
                type: Log.label_compilar,
                label: this.label,
            }, `Bundler cambiado (${bundlerAnterior} -> ${bundlerNuevo}), reiniciando compilador`);
            await this.stopCompilar();
        }
        this.config = Promise.resolve(config);

        await this.run();
    }

    /**
     * Actualiza la configuración global de workspaces y re-ejecuta `run()` para aplicar los cambios.
     * Esto puede iniciar o detener el compilador/ejecutor del servicio según los nuevos flags.
     *
     * @param global - Nueva configuración global leída de `config.workspaces.json`.
     */
    public updateGlobal(global: IConfigServices): void {
        const flags = flagsWorkspace(global.workspaces, this.nombre);
        this.global_compilar = flags.compilar ?? true;
        this.global_ejecutar = flags.ejecutar ?? true;

        this.run()
            .then(()=>undefined)
            .catch((err)=>{
                Log.error({
                    type: Log.label_base,
                    label: this.label,
                }, "Error aplicando configuración global", err);
            });
    }

    /**
     * Tarea principal del workspace servicio: inicia o detiene el compilador y el ejecutor
     * en función de la configuración local y global.
     *
     */
    protected override async run(): Promise<void> {
        await super.run();
        await Promise.all([
            this.runCompilar(),
            this.runEjecutar(),
        ]);
    }

    private async runCompilar(): Promise<void> {
        const compilar = await this.checkCompilar();
        if (compilar) {
            await this.initCompilar();
        } else {
            await this.stopCompilar();
        }
    }

    private async runEjecutar(): Promise<void> {
        const ejecutar = await this.checkEjecucion();
        if (ejecutar) {
            await this.initEjecutar();
        } else {
            await this.stopEjecutar();
        }
    }

    private async checkCompilar(): Promise<boolean> {
        if (!this.compilar) {
            return false;
        }

        if (!this.global_compilar) {
            // if (this.compilador==undefined) {
            //     Log.info({
            //         type: Log.label_compilar,
            //         label: this.label,
            //     }, `Omitiendo workspace "${this.nombre}" (global)`);
            // }
            return false;
        }

        const {manifest: config} = await this.config;

        if (!config.enabled) {
            if (this.compilador==undefined) {
                Log.info({
                    type: Log.label_compilar,
                    label: this.label,
                }, `Omitiendo workspace "${this.nombre}"`);
            }
            return false;
        }

        if (this.depsPendientes.size > 0) {
            if (this.compilador==undefined) {
                Log.info({
                    type: Log.label_compilar,
                    label: this.label,
                }, `Esperando dependencias: ${[...this.depsPendientes].join(", ")}`);
            }
            return false;
        }

        return true;
    }

    private notificarCompilacionExitosa(): void {
        if (this.primeraCompilacionEmitida) {
            return;
        }
        this.primeraCompilacionEmitida = true;
        for (const cb of this.compilarListeners) {
            cb();
        }
        this.compilarListeners.length = 0;
    }

    private depResuelta(depNombre: string): void {
        this.depsPendientes.delete(depNombre);
        if (this.depsPendientes.size > 0) {
            return;
        }
        Log.info({
            type: Log.label_compilar,
            label: this.label,
        }, `Dependencias listas, iniciando compilador`);
        this.runCompilar()
            .then(() => undefined)
            .catch((err) => {
                Log.error({
                    type: Log.label_compilar,
                    label: this.label,
                }, "Error iniciando compilador tras dependencias", err);
            });
    }

    private iniciarLogCompilar(): void {
        const dir = `${this.dir}/output`;
        const actual = `${dir}/compilar.md`;
        const anterior = `${dir}/compilar-old.md`;
        this.logCompilarInicio = fs.mkdir(dir, {recursive: true})
            .then(() => fs.unlink(anterior).catch(() => undefined))
            .then(() => fs.rename(actual, anterior).catch(() => undefined))
            .then(() => fs.writeFile(
                actual,
                `# ${this.nombre}\n## Compilación iniciada: ${fechaHoraLocal(new Date())}\n\n---\n\n`,
                "utf-8",
            ))
            .catch(() => undefined);
    }

    private async appendChunkLogCompilar(lineas: string[], tipo: "out" | "err"): Promise<void> {
        await this.logCompilarInicio;
        const prefijo = tipo === "err" ? "[ERR] " : "";
        const contenido = lineas
            .map(linea => `${prefijo}${linea.replace(/\x1B\[[0-9;]*[mGKF]/g, "")}`)
            .join("\n");
        const refs = extractFileRefs(lineas, this.root, this.dir);
        const enlaces = refs.length > 0
            ? `\n${refs.map(({label, href}) => `- [\`${label}\`](${href})`).join("\n")}\n`
            : "";
        for (const {href, lineNum, colNum} of refs) {
            const absPath = path.resolve(`${this.dir}/output`, href);
            const location = lineNum > 0
                ? colNum > 0 ? `${absPath}:${lineNum}:${colNum}` : `${absPath}:${lineNum}`
                : absPath;
            Log.info({type: Log.label_compilar, label: this.label}, location);
        }
        await fs.appendFile(
            `${this.dir}/output/compilar.md`,
            `**${horaLocal(new Date())}**\n\`\`\`\n${contenido}\n\`\`\`${enlaces}\n\n---\n\n`,
            "utf-8",
        );
    }

    private async initCompilar(): Promise<void> {
        const {manifest: config} = await this.config;

        if (!Service.COMPILABLES.includes(config.deploy.runtime)) {
            return;
        }

        if (this.watch && Service.PAUSABLES.includes(config.build.framework)) {
            this.setTimeoutCompilador();
        }

        if (this.compilador!=undefined) {
            return;
        }

        Log.info({
            type: Log.label_compilar,
            label: this.label,
        }, `Iniciando compilador`);

        if (config.build.framework === BuildFW.nextjs) {
            this.compilador = spawn(
                "yarn",
                [
                    "workspace", "@mr/core-dev", "tsc",
                    "--noEmit", ...(this.watch ? ["--watch", "--preserveWatchOutput"] : []),
                    "--project", path.join(this.dir, "tsconfig.json"),
                ],
                {
                    cwd: this.root,
                    env: { ...process.env, FORCE_COLOR: "1" },
                    stdio: "pipe",
                    shell: process.platform === "win32",
                }
            );
        } else {
            const watchArgs = this.watch
                ? (config.build.bundler === BuildBundler.rspack ? ["--env", "watch=true"] : ["--watch"])
                : [];
            this.compilador = spawn("yarn", ["run", this.nombre, "run", "packd", ...watchArgs], {
                cwd: this.root,
                env: { ...process.env, FORCE_COLOR: "1" },
                stdio: "pipe",
                shell: process.platform === "win32",
            });
        }
        this.iniciarLogCompilar();

        this.compilador.stdout.on("data", (data: Buffer)=>{
            const lineas = data.toString()
                .split("\n")
                .map(linea => linea.trim().replace(/^\[(?:\x1B\[[0-9;]*m)*\d{1,2}:\d{2}:\d{2}(?:\s*[AaPp][Mm])?(?:\x1B\[[0-9;]*m)*\]\s*/, ""))
                .filter(linea => linea.length > 0);
            for (const linea of lineas) {
                Log.info({
                    type: Log.label_compilar,
                    label: this.label,
                }, linea);
                if (!this.primeraCompilacionEmitida) {
                    const stripped = linea.replace(/\x1B\[[0-9;]*[mGKF]/g, "");
                    if ((stripped.includes("✓") && /(?:built|compiled) in/i.test(stripped)) || /compiled successfully/i.test(stripped) || /Found \d+ errors?\. Watching for file changes\./i.test(stripped)) {
                        this.notificarCompilacionExitosa();
                    }
                }
            }
            if (lineas.length > 0) {
                this.appendChunkLogCompilar(lineas, "out").catch(() => undefined);
            }
        });
        this.compilador.stderr.on("data", (data: Buffer)=>{
            const lineas = data.toString().split("\n").map(linea=>linea.trim()).filter(linea=>linea.length>0);
            for (const linea of lineas) {
                Log.error({
                    type: Log.label_compilar,
                    label: this.label,
                }, linea);
            }
            if (lineas.length > 0) {
                this.appendChunkLogCompilar(lineas, "err").catch(() => undefined);
            }
        });

        this.compilador.on("error", (error)=>{
            Log.error({
                type: Log.label_compilar,
                label: this.label,
            }, Colors.colorize([Colors.FgRed, Colors.Bright], "Error de compilador"), error);
        });

        this.compilador.on("close", ()=>{
            this.notificarCompilacionExitosa();
        });
    }

    private async stopCompilar(): Promise<void> {
        return this.detenerProceso(this.compilador, {
            type: Log.label_compilar,
            label: this.label,
            accion: "compilador",
        }, () => { this.compilador = undefined; });
    }

    private async checkEjecucion(): Promise<boolean> {
        const {manifest: config} = await this.config;

        if (!this.ejecutar || [Runtime.browser, Runtime.cfworker, Runtime.php].includes(config.deploy.runtime)) {
            return false;
        }

        if (!this.global_ejecutar) {
            // if (this.ejecucion==undefined) {
            //     Log.info({
            //         type: Log.label_ejecutar,
            //         label: this.label,
            //     }, `Omitiendo workspace "${this.nombre}" (global)`);
            // }
            return false;
        }

        if (!config.enabled) {
            if (this.ejecucion==undefined) {
                Log.info({
                    type: Log.label_ejecutar,
                    label: this.label,
                }, `Omitiendo workspace "${this.nombre}"`);
            }
            return false;
        }

        if (!config.devel) {
            if (this.ejecucion==undefined) {
                Log.info({
                    type: Log.label_ejecutar,
                    label: this.label,
                }, `Omitiendo workspace "${this.nombre}"`);
            }
            return false;
        }

        return true;
    }

    private async initEjecutar(): Promise<void> {
        if (this.ejecucion!=undefined) {
            return;
        }

        Log.info({
            type: Log.label_ejecutar,
            label: this.label,
        }, `Iniciando ejecución`);

        const {manifest: config} = await this.config;

        const comandoEjecutar = config.build.framework === BuildFW.nextjs ? "dev" : "devel";
        const argsEjecutar = config.build.framework === BuildFW.nextjs ? ["--webpack"] : [];
        this.ejecucion = spawn("yarn", ["run", this.nombre, "run", comandoEjecutar, ...argsEjecutar], {
            cwd: this.root,
            env: { ...process.env, FORCE_COLOR: "1" },
            stdio: "pipe",
            shell: process.platform === "win32",
        });
        this.ejecucion.stdout.on("data", (data: Buffer)=>{
            const lineas = data.toString().split("\n").filter(linea=>linea.length>0);
            for (const linea of lineas) {
                Log.info({
                    type: Log.label_ejecutar,
                    label: this.label,
                }, linea);
            }
        });
        this.ejecucion.stderr.on("data", (data: Buffer)=>{
            const lineas = data.toString().split("\n").filter(linea=>linea.length>0);
            for (const linea of lineas) {
                Log.error({
                    type: Log.label_ejecutar,
                    label: this.label,
                }, linea);
            }
        });

        this.ejecucion.on("error", (error)=>{
            Log.error({
                type: Log.label_ejecutar,
                label: this.label,
            }, Colors.colorize([Colors.FgRed, Colors.Bright], "Error de ejecución"), error);
        });

        this.ejecucion.on("close", (status)=>{
            status = status??0;

            if (status!=0) {
                Log.error({
                    type: Log.label_ejecutar,
                    label: this.label,
                }, `Terminado (`, status, `) Programando nueva ejecución en 30 segundos`);
                this.ejecucion = undefined;
                setTimeout(()=>{
                    this.runEjecutar()
                        .then(() => undefined)
                        .catch((err) => {
                            Log.error({
                                type: Log.label_ejecutar,
                                label: this.label,
                            }, "Error en reinicio", err);
                        });
                }, 30000);
            } else {
                if (config.deploy.cronjob) {
                    Log.info({
                        type: Log.label_ejecutar,
                        label: this.label,
                    }, `Terminado: Programando nueva ejecución en 10 minutos`);
                    this.ejecucion = undefined;
                    setTimeout(() => {
                        this.runEjecutar()
                            .then(() => undefined)
                            .catch((err) => {
                                Log.error({
                                    type: Log.label_ejecutar,
                                    label: this.label,
                                }, "Error en inicio programado", err);
                            });
                    }, 600000);
                }
            }
        });
    }

    private async stopEjecutar(): Promise<void> {
        return this.detenerProceso(this.ejecucion, {
            type: Log.label_ejecutar,
            label: this.label,
            accion: "ejecución",
        }, () => { this.ejecucion = undefined; });
    }
}
