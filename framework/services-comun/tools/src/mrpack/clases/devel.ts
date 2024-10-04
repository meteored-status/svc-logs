import { watch } from "node:fs";

import {I18N} from "./workspace/i18n";
import {IConfigServices, Service} from "./workspace/service";
import {Workspace} from "./workspace";
import {Yarn} from "./yarn";
import {PromiseDelayed} from "../../../../modules/utiles/promise";
import {isDir, readDir, readJSON} from "../../../../modules/utiles/fs";

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
                    const {Init} = await import(/* webpackChunkName: "mrpack/init" */ "./init");
                    const {Framework} = await import(/* webpackChunkName: "mrpack/framework" */ "./framework");
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
        const [framework, packages] = await Promise.all([
            this.ejecutarWorkspaces(basedir, "framework"),
            this.ejecutarWorkspaces(basedir, "packages"),
        ]);
        const existe = await this.ejecutarServices(ejecucion, basedir, [...framework, ...packages]);
        if (!existe) {
            for (const actual of [framework, packages].flat()) {
                actual.parar();
            }
        }
    }

    private static async ejecutarWorkspaces(basedir: string, path: string): Promise<Workspace[]> {
        if (!await isDir(`${basedir}/${path}`)) {
            return [];
        }

        const workspaces_list = await readDir(`${basedir}/${path}`);
        return Promise.all(workspaces_list.map(workspace=>this.ejecutarWorkspace(basedir, path, workspace)));
    }

    private static async ejecutarWorkspace(basedir: string, path: string, workspace: string): Promise<Workspace> {
        const devel = new Workspace({
            nombre: workspace,
            path,
            root: basedir,
        });

        return devel.init().then(()=>devel);
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
                i18n: true,
                services: {},
            } as IConfigServices;
        });

        if (!await isDir(`${basedir}/services`)) {
            return false;
        }

        const workspaces_list = await readDir(`${basedir}/services`);
        const length = workspaces_list.reduce((a, b)=>Math.max(a, b.length), 0);

        if (ejecucion.compilar && await isDir(`${basedir}/i18n`)) {
            const i18n = new Workspace({
                nombre: "i18n",
                root: basedir,
            });
            await i18n.init();
            dependencias.push(i18n);

            await this.ejecutarI18N(ejecucion, basedir, length);
        }

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
                        i18n: true,
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

    private static async ejecutarI18N(ejecucion: IConfigEjecucion, basedir: string, length: number): Promise<boolean> {
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
                i18n: true,
                services: {},
            } as IConfigServices;
        });

        const i18n = new I18N({
            nombre: "i18n",
            root: basedir,
            pad: length,
            global: config_global,
        });
        await i18n.init();

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
                        i18n: true,
                        services: {},
                    } as IConfigServices;
                })
                .then(async (config_global)=>{
                    i18n.updateGlobal(config_global);
                });
        });

        return true;
    }

    /* INSTANCE */
}
