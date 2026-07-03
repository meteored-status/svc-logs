/**
 * Editor: José Antonio Jiménez
 * Fecha: Thu, 02 Jul 2026 11:35:20 GMT
 * Hash: cb49b9d0016fb19a742ef1902b593a06
 * Versión: 2026.7.2+4-josantoniojimnez
 * Anterior: 2026.7.2+3-josantoniojimnez
 * Proyecto: https://github.com/alpred/meteored-svc-ads.git
 */

import {ChildProcessWithoutNullStreams, spawn} from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import chokidar, {type ChokidarOptions} from "chokidar";
import treeKill from "tree-kill";

import type {Manifest} from "@mr/core-dev/manifest";
import {BuildBundler, BuildFW} from "@mr/core-dev/manifest/build";
import {Runtime} from "@mr/core-dev/manifest/deployment";

import {Colors} from "../colors";
import {type IWorkspace, Workspace} from "../workspace";
import {Log} from "../log";
import {ManifestWorkspaceLoader} from "../manifest/workspace";

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

/**
 * Configuración personal de workspaces leída de `config.workspaces.json`.
 *
 * @property devel     - Workspaces habilitados/deshabilitados para el modo devel.
 * @property packd     - Workspaces habilitados/deshabilitados para la compilación.
 * @property i18n      - Si `true`, el workspace de i18n está habilitado.
 * @property services  - Mapa de variables de entorno adicionales por servicio.
 * @property framework - Política de actualización automática de frameworks.
 * @property patch     - Último patch aplicado (`RXXX`) por `yarn run patch:apply`.
 */
export interface IConfigServices {
    devel: {
        available: string[];
        disabled: string[];
    };
    packd: {
        available: string[];
        disabled: string[];
    };
    i18n: boolean;
    services: Record<string, string>;
    framework?: {
        updates: FrameworkUpdates;
    };
    patch?: string;
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

    private static horaLocal(d: Date): string {
        return [d.getHours(), d.getMinutes(), d.getSeconds()]
            .map(n => String(n).padStart(2, "0"))
            .join(":");
    }

    private static fechaHoraLocal(d: Date): string {
        const pad = (n: number) => String(n).padStart(2, "0");
        return [
            `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`,
            Service.horaLocal(d),
        ].join(" ");
    }

    private static getBundlerCoherente(config: Manifest): BuildBundler {
        switch (config.deploy.runtime) {
            case Runtime.browser:
                return BuildBundler.rspack;
            case Runtime.cfworker:
            case Runtime.php:
                return BuildBundler.none;
            case Runtime.node:
            default:
                if (config.build.framework===BuildFW.nextjs) {
                    return BuildBundler.none;
                }
                if (config.build.bundle.toJSON()?.componentes!=undefined && Object.keys(config.build.bundle.toJSON()?.componentes ?? {}).length>0) {
                    return BuildBundler.rspack;
                }
                return BuildBundler.esbuild;
        }
    }

    private static getBundlerNormalizado(config: Manifest): BuildBundler {
        const bundlerEsperado = Service.getBundlerCoherente(config);
        if (bundlerEsperado===BuildBundler.esbuild && config.build.bundler===BuildBundler.rspack) {
            return BuildBundler.rspack;
        }
        return bundlerEsperado;
    }

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
        this.global_compilar = !data.global.packd.disabled.includes(this.nombre);
        this.global_ejecutar = !data.global.devel.disabled.includes(this.nombre);
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
        const bundlerNuevo = Service.getBundlerNormalizado(config.manifest);
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
        this.global_compilar = !global.packd.disabled.includes(this.nombre);
        this.global_ejecutar = !global.devel.disabled.includes(this.nombre);

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
                `# ${this.nombre}\n## Compilación iniciada: ${Service.fechaHoraLocal(new Date())}\n\n---\n\n`,
                "utf-8",
            ))
            .catch(() => undefined);
    }

    private extractFileRefs(lineas: string[]): {label: string; href: string; lineNum: number; colNum: number}[] {
        const patron = /([^\s'"<>()|,]+\.(?:tsx|ts|jsx|js|mjs|cjs|scss|css|html))(?::(\d+)(?::(\d+))?)?/g;
        const refs: Map<string, {label: string; href: string; baseName: string; lineNum: number; colNum: number}> = new Map();
        for (const linea of lineas) {
            const text = linea.replace(/\x1B\[[0-9;]*[mGKF]/g, "").replace(/^\[ERR] /, "");
            patron.lastIndex = 0;
            let match = patron.exec(text);
            while (match !== null) {
                const rawPath = match[1];
                if (rawPath.includes("node_modules")) {
                    continue;
                }
                const lineNum = match[2] !== undefined ? parseInt(match[2], 10) : 0;
                const colNum = match[3] !== undefined ? parseInt(match[3], 10) : 0;
                // rspack corre desde {root}/@mr/core/dev (yarn workspace @mr/core-dev)
                // → las rutas relativas del output son relativas a ese directorio
                const rspackCwd = path.join(this.root, "@mr", "core", "dev");
                const absPath = path.resolve(rspackCwd, rawPath);
                const relPath = path.relative(path.join(this.dir, "output"), absPath);
                const key = `${relPath}:${lineNum}:${colNum}`;
                if (!refs.has(key)) {
                    const baseName = path.basename(rawPath);
                    const label = lineNum > 0
                        ? colNum > 0
                            ? `${baseName}:${lineNum}:${colNum}`
                            : `${baseName}:${lineNum}`
                        : baseName;
                    refs.set(key, {label, href: relPath, baseName, lineNum, colNum});
                }
                match = patron.exec(text);
            }
        }
        return [...refs.values()]
            .sort((a, b) =>
                a.baseName.localeCompare(b.baseName) ||
                a.lineNum - b.lineNum ||
                a.colNum - b.colNum
            )
            .map(({label, href, lineNum, colNum}) => ({label, href, lineNum, colNum}));
    }

    private async appendChunkLogCompilar(lineas: string[], tipo: "out" | "err"): Promise<void> {
        await this.logCompilarInicio;
        const prefijo = tipo === "err" ? "[ERR] " : "";
        const contenido = lineas
            .map(linea => `${prefijo}${linea.replace(/\x1B\[[0-9;]*[mGKF]/g, "")}`)
            .join("\n");
        const refs = this.extractFileRefs(lineas);
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
            `**${Service.horaLocal(new Date())}**\n\`\`\`\n${contenido}\n\`\`\`${enlaces}\n\n---\n\n`,
            "utf-8",
        );
    }

    private async initCompilar(): Promise<void> {
        const {manifest: config} = await this.config;

        if (!Service.COMPILABLES.includes(config.deploy.runtime)) {
            return;
        }

        if (Service.PAUSABLES.includes(config.build.framework)) {
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
                    "--noEmit", "--watch", "--preserveWatchOutput",
                    "--project", path.join(this.dir, "tsconfig.json"),
                ],
                {
                    cwd: this.root,
                    env: { ...process.env, FORCE_COLOR: "1" },
                    stdio: "pipe",
                    shell: false,
                }
            );
        } else {
            this.compilador = spawn("yarn", ["run", this.nombre, "run", "packd"], {
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
        return new Promise((resolve, reject)=>{
            if (this.compilador==undefined) {
                resolve();
                return;
            }

            Log.info({
                type: Log.label_compilar,
                label: this.label,
            }, `Deteniendo compilador (`, this.compilador.pid, ")");
            if (this.compilador.pid == undefined) {
                resolve();
                return;
            }

            treeKill(this.compilador.pid, (err) => {
                if (err) {
                    Log.error({
                        type: Log.label_compilar,
                        label: this.label,
                    }, `Deteniendo compilador => KO`, err);
                    reject(err);
                } else {
                    Log.info({
                        type: Log.label_compilar,
                        label: this.label,
                    }, `Deteniendo compilador => OK`);
                    this.compilador = undefined;
                    resolve();
                }
            });
        });
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
        return new Promise((resolve, reject)=>{
            if (this.ejecucion==undefined) {
                resolve();
                return;
            }

            Log.info({
                type: Log.label_ejecutar,
                label: this.label,
            }, `Deteniendo ejecución (`, this.ejecucion.pid, ")");
            if (this.ejecucion.pid == undefined) {
                resolve();
                return;
            }

            treeKill(this.ejecucion.pid, (err)=>{
                if (err) {
                    Log.error({
                        type: Log.label_ejecutar,
                        label: this.label,
                    }, `Deteniendo ejecución => KO`, err);
                    reject(err);
                } else {
                    Log.info({
                        type: Log.label_ejecutar,
                        label: this.label,
                    }, `Deteniendo ejecución => OK`);
                    this.ejecucion = undefined;
                    resolve();
                }
            });
        });
    }
}
