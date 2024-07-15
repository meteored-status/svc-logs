import { watch } from "node:fs";

import { Framework } from "./framework";
import { IConfigServices, Service } from "./workspace/service";
import { Init } from "./init";
import {Workspace} from "./workspace";
import {Yarn} from "./yarn";
import {PromiseDelayed} from "../../../modules/utiles/promise";
import {isDir, readDir, readJSON} from "../../../modules/utiles/fs";

export interface IConfigEjecucion {
    compilar: boolean;
    ejecutar: boolean;
    forzar: boolean;
}

export class Devel {
    /* STATIC */
    public static run(basedir: string, config: IConfigEjecucion): void {
        PromiseDelayed()
            .then(async ()=>{
                if (config.compilar) {
                    const cambios = [
                        await Init.init(basedir),
                        await Framework.update(basedir),
                    ];

                    if (cambios.reduce((a, b)=>a || b, false)) {
                        await Yarn.install(basedir, {verbose:false});
                    }
                }
                await this.ejecutar(config, basedir);
            })
            .catch((err)=>{
                if (err!=undefined) {
                    console.error(err);
                }
            });
    }

    private static async ejecutar(ejecucion: IConfigEjecucion, basedir: string): Promise<void> {
        const [framework, packages, statics] = await Promise.all([
            this.ejecutarWorkspace(basedir, "framework"),
            this.ejecutarWorkspace(basedir, "packages"),
            this.ejecutarWorkspace(basedir, "statics"),
        ]);
        const existe = await this.ejecutarServices(ejecucion, basedir, [...framework, ...packages, ...statics]);
        if (!existe) {
            for (const actual of [framework, packages, statics].flat()) {
                actual.parar();
            }
        }
    }

    private static async ejecutarWorkspace(basedir: string, path: string): Promise<Workspace[]> {
        if (!await isDir(`${basedir}/${path}`)) {
            return [];
        }

        const workspaces_list = await readDir(`${basedir}/${path}`);

        const workspaces: Promise<Workspace>[] = [];
        for (const workspace of workspaces_list) {
            const devel = new Workspace({
                nombre: workspace,
                path,
                root: basedir,
            });

            workspaces.push(devel.init().then(()=>devel));
        }

        return await Promise.all(workspaces);
    }

    private static async ejecutarServices(ejecucion: IConfigEjecucion, basedir: string, dependencias: Workspace[]): Promise<boolean> {
        const config_global = await readJSON<IConfigServices>(`${basedir}/config.workspaces.json`).catch(()=>{
            return {
                devel: {
                    available: [],
                    disabled: [],
                },
                packd: {
                    available: [],
                    disabled: [],
                },
                services: {},
            } as IConfigServices;
        });

        if (!await isDir(`${basedir}/services`)) {
            return false;
        }
        const workspaces_list = await readDir(`${basedir}/services`);
        const length = workspaces_list.reduce((a, b)=>Math.max(a, b.length), 0);

        const workspaces: Promise<Service>[] = [];
        for (const workspace of workspaces_list) {
            const devel = new Service({
                nombre: workspace,
                path: "services",
                root: basedir,
                pad: length,
                compilar: ejecucion.compilar,
                ejecutar: ejecucion.ejecutar,
                forzar: ejecucion.forzar,
                global: config_global,
            });

            workspaces.push(devel.init().then(()=>{
                for (const dependencia of dependencias) {
                    dependencia.addHijo(devel);
                }
                return devel;
            }));
        }
        const services = await Promise.all(workspaces);

        watch(`${basedir}/config.workspaces.json`, ()=>{
            readJSON<IConfigServices>(`${basedir}/config.workspaces.json`)
                .catch(()=>{
                    return {
                        devel: {
                            available: [],
                            disabled: [],
                        },
                        packd: {
                            available: [],
                            disabled: [],
                        },
                        services: {},
                    } as IConfigServices;
                })
                .then(async (config_global)=>{
                    for (const actual of services) {
                        actual.updateGlobal(config_global);
                    }
                });
        });

        return true;
    }

    /* INSTANCE */
}
