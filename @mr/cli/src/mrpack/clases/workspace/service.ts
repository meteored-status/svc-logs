import {ChildProcessWithoutNullStreams, spawn} from "node:child_process";
import chokidar, {type ChokidarOptions} from "chokidar";
import treeKill from "tree-kill";

import {BuildFW} from "@mr/cli/manifest/build";
import {Runtime} from "@mr/cli/manifest/deployment";

import {Colors} from "../colors";
import {type IWorkspace, Workspace} from "../workspace";
import {Log} from "../log";
import {ManifestWorkspaceLoader} from "../manifest/workspace";

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
}

export interface IService extends IWorkspace {
    pad: number;
    compilar: boolean;
    ejecutar: boolean;
    forzar: boolean;
    global: IConfigServices;
}

export class Service extends Workspace {
    /* STATIC */
    private static TIMEOUT = 300000;
    private static COMPILABLES: (Runtime|undefined)[] = [Runtime.node, Runtime.browser, Runtime.cfworker];
    private static PAUSABLES: (BuildFW|undefined)[] = [BuildFW.meteored];

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
    }

    protected override initWatcher(): void {
        this.watcher?.close();
        const options: ChokidarOptions = {
            persistent: true,
            ignored: (path) => path.endsWith("~") || path.startsWith(`output/`) || path.startsWith(`assets/`) || path.startsWith(`files/`) || path.startsWith(`.next/`),
            ignoreInitial: true,
            cwd: this.dir,
        };

        const watchFN = (path: string): void => {
            if (path == "mrpack.json") {
                this.updatePackageFile();
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
        this.runCompilar().then(() => {
        }).catch((err) => {
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
            this.stopCompilar().then(() => {
            }).catch((err) => {
                Log.error({
                    type: Log.label_base,
                    label: this.label,
                }, "Error pausando el compilador", err);
            });
        }, Service.TIMEOUT);
    }

    private updatePackageFile(): void {
        this.config = new ManifestWorkspaceLoader(this.dir).load();

        this.run().then(() => {
        }).catch((err) => {
            Log.error({
                type: Log.label_base,
                label: this.label,
            }, "Error aplicando configuración específica", err);
        });
    }

    public updateGlobal(global: IConfigServices): void {
        this.global_compilar = !global.packd.disabled.includes(this.nombre);
        this.global_ejecutar = !global.devel.disabled.includes(this.nombre);

        this.run().then(()=>{}).catch((err)=>{
            Log.error({
                type: Log.label_base,
                label: this.label,
            }, "Error aplicando configuración global", err);
        });
    }

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

        return true;
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

        let comando: string;
        const args: string[] = [];
        switch(config.build.framework) {
            // case EFramework.astro:
            case BuildFW.nextjs:
                comando = "dev";
                // args.push("--webpack");
                break;
            case BuildFW.meteored:
            default:
                comando = "packd";
        }

        Log.info({
            type: Log.label_compilar,
            label: this.label,
        }, `Iniciando compilador`);
        this.compilador = spawn("yarn", ["run", this.nombre, "run", comando, ...args], {
            cwd: this.root,
            env: { ...process.env, FORCE_COLOR: "1" },
            stdio: "pipe",
            shell: true,
        });

        this.compilador.stdout.on("data", (data: Buffer)=>{
            const lineas = data.toString().split("\n").map(linea=>linea.trim()).filter(linea=>linea.length>0);
            for (const linea of lineas) {
                Log.info({
                    type: Log.label_compilar,
                    label: this.label,
                }, linea);
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
        });

        this.compilador.on("error", (error)=>{
            Log.error({
                type: Log.label_compilar,
                label: this.label,
            }, Colors.colorize([Colors.FgRed, Colors.Bright], "Error de compilador"), error);
        });

        // this.compilador.on("close", ()=>{
        //     console.log("Terminado")
        // });
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

        if (!this.ejecutar || [Runtime.browser, Runtime.cfworker].includes(config.deploy.runtime) || [/*EFramework.astro,*/ BuildFW.nextjs].includes(config.build.framework)) {
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

        this.ejecucion = spawn("yarn", ["run", this.nombre, "run", "devel"], {
            cwd: this.root,
            env: { ...process.env, FORCE_COLOR: "1" },
            stdio: "pipe",
            shell: true,
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
                setTimeout(()=>{
                    this.runEjecutar().then(() => {
                    }).catch((err) => {
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
                        this.runEjecutar().then(() => {
                        }).catch((err) => {
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
