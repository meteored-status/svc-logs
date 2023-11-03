import {ChildProcessWithoutNullStreams, spawn} from "node:child_process";
import {watch} from "node:fs";
import os from "node:os";
import treeKill from "tree-kill";

import {Colors} from "../colors";
import {IWorkspace, Workspace} from "../workspace";
import {readJSON} from "../../../../modules/utiles/fs";
import {Log} from "../log";

export interface IConfigServices {
    devel: {
        available: string[];
        disabled: string[];
    };
    packd: {
        available: string[];
        disabled: string[];
    };
    services: NodeJS.Dict<string>;
}

export enum ERuntime {
    node = "node",
    browser = "browser",
    php = "php",
}

export enum EFramework {
    meteored = "meteored",
    nextjs = "nextjs",
    // astro = "astro",
}

export interface IConfigService {
    cronjob: boolean;
    devel: boolean;
    deploy: boolean;
    generar: boolean;
    unico: boolean;
    deps: string[];
    storage: string[];
    runtime: ERuntime;
    framework: EFramework;
    credenciales: {
        source: string;
        target: string;
    }[];
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
    private static COMPILABLES: (ERuntime|undefined)[] = [ERuntime.node, ERuntime.browser];
    private static PAUSABLES: (EFramework|undefined)[] = [EFramework.meteored];

    /* INSTANCE */
    private readonly compilar: boolean;
    private readonly ejecutar: boolean;

    private readonly label: string;
    private global_compilar: boolean;
    private global_ejecutar: boolean;
    private config: Promise<IConfigService>;

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
        this.config = readJSON(`${this.dir}/package.json`).then(paquete=>paquete.config??{} as IConfigService);
    }

    protected override initWatcher(): void {
        this.watcher?.close();
        if (os.platform()!="linux") {
            this.watcher = watch(this.dir, {recursive: true}, (ev, filename) => {
                if (filename?.endsWith("~")) {
                    return;
                }

                if (filename == "package.json") {
                    this.updatePackageFile();
                }

                this.cambio();
            });
        } else {
            this.watcher = watch(`${this.dir}/package.json`, () => {
                this.updatePackageFile();
            });
        }
    }

    // private stopWatcher(): void {
    //     this.watcher?.close();
    //     this.watcher = watch(`${this.dir}/package.json`, ()=>{
    //         this.updatePackageFile();
    //     });
    // }

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
        if (os.platform()=="linux") {
            return;
        }
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
        this.config = readJSON(`${this.dir}/package.json`).then(paquete => paquete.config ?? {} as IConfigService);

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
            if (this.compilador==undefined) {
                Log.info({
                    type: Log.label_compilar,
                    label: this.label,
                }, `Omitiendo workspace "${this.nombre}" (global)`);
            }
            return false;
        }

        const config = await this.config;

        if (!config.generar) {
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
        const config = await this.config;

        if (!Service.COMPILABLES.includes(config.runtime)) {
            return;
        }

        if (Service.PAUSABLES.includes(config.framework)) {
            this.setTimeoutCompilador();
        }

        if (this.compilador!=undefined) {
            return;
        }

        let comando: string;
        switch(config.framework) {
            // case EFramework.astro:
            case EFramework.nextjs:
                comando = "dev";
                break;
            case EFramework.meteored:
            default:
                comando = "packd";
        }

        Log.info({
            type: Log.label_compilar,
            label: this.label,
        }, `Iniciando compilador`);

        this.compilador = spawn("yarn", ["run", this.nombre, "run", comando], {
            cwd: this.root,
            env: { ...process.env, FORCE_COLOR: "1" },
            stdio: "pipe",
            shell: true,
        });

        this.compilador.stdout.on("data", (data: Buffer)=>{
            const lineas = data.toString().split("\n").filter(linea=>linea.length>0);
            for (const linea of lineas) {
                Log.info({
                    type: Log.label_compilar,
                    label: this.label,
                }, linea);
            }
        });
        this.compilador.stderr.on("data", (data: Buffer)=>{
            const lineas = data.toString().split("\n").filter(linea=>linea.length>0);
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
        const config = await this.config;

        if (!this.ejecutar || config.runtime==ERuntime.browser || [/*EFramework.astro,*/ EFramework.nextjs].includes(config.framework)) {
            return false;
        }

        if (!this.global_ejecutar) {
            if (this.ejecucion==undefined) {
                Log.info({
                    type: Log.label_ejecutar,
                    label: this.label,
                }, `Omitiendo workspace "${this.nombre}" (global)`);
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

        const config = await this.config;

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
                if (config.cronjob) {
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
