import {ChildProcessWithoutNullStreams, spawn} from "node:child_process";
import chokidar from "chokidar";
import treeKill from "tree-kill";

import {Deferred} from "services-comun/modules/utiles/promise";

import {Colors} from "../colors";
import {IConfigServices} from "./service";
import {IWorkspace, Workspace} from "../workspace";
import {Log} from "../log";

export interface IService extends IWorkspace {
    pad: number;
    global: IConfigServices;
}

export class I18N extends Workspace {
    /* STATIC */
    private static TIMEOUT = 300000;

    /* INSTANCE */
    private compilar: boolean;

    private readonly label: string;

    private compilador?: ChildProcessWithoutNullStreams;
    private timeout?: NodeJS.Timeout;

    public constructor(data: IService) {
        super(data);

        const nombre = data.nombre.padEnd(data.pad);
        const color = Colors.nextColor();

        this.compilar = data.global.i18n;

        this.label = Colors.colorize(color, nombre);
    }

    protected override initWatcher(): void {
        this.watcher?.close();
        // if (os.platform()!="linux") {
        this.watcher = chokidar.watch(`${this.dir}/.json/`, {
            persistent: true,
            ignored: (path)=>path.endsWith("~"),
        }).on("change", () => {
            this.cambio();
        });
        // }
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
        // if (os.platform()=="linux") {
        //     return;
        // }
        if (this.timeout!=undefined) {
            clearTimeout(this.timeout);
        }
        this.timeout = setTimeout(()=>{
            this.stopCompilar()
                .then(() => {})
                .catch((err) => {
                    Log.error({
                        type: Log.label_base,
                        label: this.label,
                    }, "Error pausando el compilador", err);
                });
        }, I18N.TIMEOUT);
    }

    public updateGlobal(global: IConfigServices): void {
        this.compilar = global.i18n;

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

    private async checkCompilar(): Promise<boolean> {
        if (!this.compilar) {
            if (this.compilador==undefined) {
                Log.info({
                    type: Log.label_compilar,
                    label: this.label,
                }, `Omitiendo workspace "${this.nombre}" (global)`);
            }
            return false;
        }

        return true;
    }

    private async initCompilar(): Promise<void> {

        this.setTimeoutCompilador();

        if (this.compilador!=undefined) {
            return;
        }

        Log.info({
            type: Log.label_compilar,
            label: this.label,
        }, `Iniciando generación de idiomas`);

        this.compilador = spawn("yarn", ["run", "i18n", "run", "generate", "--watch"], {
            cwd: this.root,
            env: { ...process.env, FORCE_COLOR: "1" },
            stdio: "pipe",
            shell: true,
        });

        const deferred = new Deferred<void>();
        let inicializado = false;

        this.compilador.stdout.on("data", (data: Buffer)=>{
            const lineas = data.toString().split("\n").filter(linea=>linea.length>0);
            for (const linea of lineas) {
                Log.info({
                    type: Log.label_compilar,
                    label: this.label,
                }, linea);
            }
            if (!inicializado) {
                inicializado = true;
                deferred.resolve();
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
            if (!inicializado) {
                inicializado = true;
                deferred.resolve();
            }
        });

        this.compilador.on("error", (error)=>{
            Log.error({
                type: Log.label_compilar,
                label: this.label,
            }, Colors.colorize([Colors.FgRed, Colors.Bright], "Error de generación de idiomas"), error);
        });

        // this.compilador.on("close", ()=>{
        //     console.log("Terminado")
        // });

        await deferred.promise;
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
            }, `Deteniendo generación de idiomas (`, this.compilador.pid, ")");
            if (this.compilador.pid == undefined) {
                resolve();
                return;
            }

            treeKill(this.compilador.pid, (err) => {
                if (err) {
                    Log.error({
                        type: Log.label_compilar,
                        label: this.label,
                    }, `Deteniendo generación de idiomas => KO`, err);
                    reject(err);
                } else {
                    Log.info({
                        type: Log.label_compilar,
                        label: this.label,
                    }, `Deteniendo generación de idiomas => OK`);
                    this.compilador = undefined;
                    resolve();
                }
            });
        });
    }
}
