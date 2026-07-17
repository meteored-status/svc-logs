/**
 * Editor: José Antonio Jiménez
 * Fecha: Fri, 17 Jul 2026 10:46:55 GMT
 * Hash: 04e3e58475be8c639ff85965724e1873
 * Versión: 2026.7.17+1-josantoniojimnez
 * Anterior: 2026.7.14+1-josantoniojimnez
 * Proyecto: https://github.com/meteored-status/svc-logs.git
 */

import {spawn, type ChildProcessWithoutNullStreams} from "node:child_process";
import chokidar from "chokidar";

import {Deferred} from "services-comun/modules/utiles/promise";

import {Colors} from "../colors";
import type {IConfigServices} from "./service";
import {type IWorkspace, Workspace} from "../workspace";
import {Log} from "../log";
import {readJSON} from "../../../utiles/fs";
import type {IPackageJson} from "../packagejson";

export interface IService extends IWorkspace {
    pad: number;
    global: IConfigServices;
}

/**
 * Workspace del generador de internacionalización (`i18n`).
 * Lanza `mrlang generate --watch` y lo reinicia ante cambios en los ficheros `.json` de traducción.
 */
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
        if (this.timeout!==undefined) {
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
        }, I18N.TIMEOUT);
    }

    /**
     * Actualiza la configuración global de workspaces y re-ejecuta el generador si es necesario.
     *
     * @param global - Nueva configuración global leída de `config.workspaces.json`.
     */
    public updateGlobal(global: IConfigServices): void {
        this.compilar = global.i18n;

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
     * Tarea principal del workspace i18n: inicia o detiene el generador de idiomas según la configuración.
     *
     */
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
            if (this.compilador===undefined) {
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

        if (this.watch) {
            this.setTimeoutCompilador();
        }

        if (this.compilador!==undefined) {
            return;
        }

        Log.info({
            type: Log.label_compilar,
            label: this.label,
        }, `Iniciando generación de idiomas`);

        // Cargamos el package.json
        const paquete = await readJSON<IPackageJson>(`${this.dir}/package.json`).catch(()=>undefined);

        const version = paquete?.scripts?.['generate']?.match(/-v2/) ? 'v2' : 'v1';

        Log.info({
            type: Log.label_compilar,
            label: this.label,
        }, `Usando versión ${version} del generador de idiomas`);

        this.compilador = spawn("yarn", ["run", "i18n", "run", "generate", `-${version}`, ...(this.watch ? ["--watch"] : [])], {
            cwd: this.root,
            env: { ...process.env, FORCE_COLOR: "1" },
            stdio: "pipe",
            shell: process.platform === "win32",
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

        await deferred.promise;
    }

    private async stopCompilar(): Promise<void> {
        return this.detenerProceso(this.compilador, {
            type: Log.label_compilar,
            label: this.label,
            accion: "generación de idiomas",
        }, () => { this.compilador = undefined; });
    }
}
