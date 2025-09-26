import chokidar from "chokidar";

import {isDir, readDir, readJSON} from "services-comun/modules/utiles/fs";
import {PromiseDelayed} from "services-comun/modules/utiles/promise";

import {I18N} from "./workspace/i18n";
import {IConfigServices, Service} from "./workspace/service";
import {Workspace} from "./workspace";
import {Yarn} from "./yarn";

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
                        await Framework.pull(basedir, false),
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

    private static async loadConfig(basedir: string): Promise<IConfigServices> {
        return readJSON<IConfigServices>(`${basedir}/config.workspaces.json`).catch(()=>({
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
        } as IConfigServices));
    }

    private static async ejecutarServices(ejecucion: IConfigEjecucion, basedir: string, dependencias: Workspace[]): Promise<boolean> {
        const config_global = await this.loadConfig(basedir);

        const groups: string[] = ['cronjobs', 'scripts', 'services'];

        const workspacesList: Record<string, string[]> = {};

        for (const group of groups) {
            if (await isDir(`${basedir}/${group}`)) {
                workspacesList[group] = await readDir(`${basedir}/${group}`);
            } else {
                workspacesList[group] = [];
            }
        }

        const length = Math.max(
            ...groups.map(group => workspacesList[group].reduce((a, b) => Math.max(a, b.length), 0)),
        );

        // const cronjobs_list: string[] = [];
        // const services_list: string[] = [];
        // if (await isDir(`${basedir}/cronjobs`)) {
        //     cronjobs_list.push(...await readDir(`${basedir}/cronjobs`));
        // }
        // if (await isDir(`${basedir}/services`)) {
        //     services_list.push(...await readDir(`${basedir}/services`));
        // }
        // const length = Math.max(
        //     cronjobs_list.reduce((a, b)=>Math.max(a, b.length), 0),
        //     services_list.reduce((a, b)=>Math.max(a, b.length), 0),
        // );
        if (length==0) {
            return false;
        }

        let i18n: I18N | undefined;
        if (ejecucion.compilar && await isDir(`${basedir}/i18n`)) {
            i18n = i18n = new I18N({
                nombre: "i18n",
                root: basedir,
                pad: length,
                global: config_global,
            });
            await i18n.init();
            dependencias.push(i18n);
        }

        const workspaces: Promise<Service>[] = [];

        for (const group of groups) {
            for (const workspace of workspacesList[group]) {
                const devel = new Service({
                    nombre: workspace,
                    path: group,
                    root: basedir,
                    pad: length,
                    compilar: ejecucion.compilar,
                    ejecutar: ejecucion.ejecutar,
                    forzar: ejecucion.forzar,
                    global: config_global,
                });

                workspaces.push(devel.init().then(() => {
                    for (const dependencia of dependencias) {
                        dependencia.addHijo(devel);
                    }
                    return devel;
                }));
            }
        }

        // for (const workspace of cronjobs_list) {
        //     const devel = new Service({
        //         nombre: workspace,
        //         path: "cronjobs",
        //         root: basedir,
        //         pad: length,
        //         compilar: ejecucion.compilar,
        //         ejecutar: ejecucion.ejecutar,
        //         forzar: ejecucion.forzar,
        //         global: config_global,
        //     });
        //
        //     workspaces.push(devel.init().then(()=>{
        //         for (const dependencia of dependencias) {
        //             dependencia.addHijo(devel);
        //         }
        //         return devel;
        //     }));
        // }
        // for (const workspace of services_list) {
        //     const devel = new Service({
        //         nombre: workspace,
        //         path: "services",
        //         root: basedir,
        //         pad: length,
        //         compilar: ejecucion.compilar,
        //         ejecutar: ejecucion.ejecutar,
        //         forzar: ejecucion.forzar,
        //         global: config_global,
        //     });
        //
        //     workspaces.push(devel.init().then(()=>{
        //         for (const dependencia of dependencias) {
        //             dependencia.addHijo(devel);
        //         }
        //         return devel;
        //     }));
        // }
        const services = await Promise.all(workspaces);

        chokidar.watch(`${basedir}/config.workspaces.json`, {
            persistent: true,
        }).on("change", ()=>{
            this.loadConfig(basedir)
                .then(async (config_global)=>{
                    for (const actual of services) {
                        actual.updateGlobal(config_global);
                    }
                    if (i18n!=undefined) {
                        i18n.updateGlobal(config_global);
                    }
                });
        });

        return true;
    }

    /* INSTANCE */
}
