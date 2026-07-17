/**
 * Editor: José Antonio Jiménez
 * Fecha: Fri, 17 Jul 2026 10:46:55 GMT
 * Hash: f72fce3aa3dc373a017eefd97371880a
 * Versión: 2026.7.17+1-josantoniojimnez
 * Anterior: 2026.7.14+1-josantoniojimnez
 * Proyecto: https://github.com/meteored-status/svc-logs.git
 */

import chokidar from "chokidar";

import {PromiseDelayed} from "services-comun/modules/utiles/promise";

import {isDir, readDir} from "../../utiles/fs";
import {GRUPOS, cargarConfig} from "./config/datos";
import {actualizarTodo} from "./framework";
import {init} from "./init";
import {aplicarPatches} from "./patches";
import {I18N} from "./workspace/i18n";
import {sanitizeFrameworkUpdates, Service} from "./workspace/service";
import {Log} from "./log";
import {Workspace} from "./workspace";
import {install} from "./yarn";

/**
 * Opciones de ejecución del entorno de desarrollo.
 *
 * @property compilar - Si `true`, compila los workspaces habilitados.
 * @property ejecutar - Si `true`, ejecuta los servicios tras compilar.
 * @property forzar   - Si `true`, fuerza la compilación aunque no haya cambios.
 * @property watch    - Si `true`, los compiladores permanecen observando cambios. Si `false`,
 *   compilan una única vez y el proceso termina al finalizar todos ellos.
 */
export interface IConfigEjecucion {
    compilar: boolean;
    ejecutar: boolean;
    forzar: boolean;
    watch: boolean;
}

/**
 * Arranca el entorno de desarrollo: inicializa dependencias si es necesario
 * y pone en marcha los watchers de compilación y ejecución de cada workspace.
 *
 * @param basedir - Raíz absoluta del monorepo.
 * @param config  - Opciones de ejecución ({compilar, ejecutar, forzar}).
 */
export function run(basedir: string, config: IConfigEjecucion): void {
    PromiseDelayed()
        .then(async ()=>{
            if (config.compilar) {
                const cfgWorkspaces = await cargarConfig(basedir);
                const frameworkUpdates = sanitizeFrameworkUpdates(cfgWorkspaces.framework?.updates);
                const cambios = [
                    await init(basedir),
                    await actualizarTodo(basedir, {forzar: false, reiniciar: true, frameworkUpdates}),
                ];

                if (cambios.reduce((a, b)=>a || b, false)) {
                    await install(basedir, {verbose:false});
                }

                await aplicarPatches(basedir);
            }
            await ejecutar(config, basedir);
        })
        .catch((err)=>{
            if (err!==undefined) {
                Log.error({type: Log.label_base, label: "devel"}, err);
            }
        });
}

async function ejecutar(ejecucion: IConfigEjecucion, basedir: string): Promise<void> {
    const frameworks = await Promise.all([
        ejecutarWorkspaces(basedir, "@mr/core", ejecucion.watch),
        ejecutarWorkspaces(basedir, "@mr/user", ejecucion.watch),
        ejecutarWorkspaces(basedir, "framework", ejecucion.watch),
        ejecutarWorkspaces(basedir, "packages", ejecucion.watch),
    ]).then(frameworks=>frameworks.flat());

    if (!await ejecutarServices(ejecucion, basedir, frameworks)) {
        for (const actual of frameworks) {
            actual.parar();
        }
    }
}

async function ejecutarWorkspaces(basedir: string, path: string, watch: boolean): Promise<Workspace[]> {
    if (!await isDir(`${basedir}/${path}`)) {
        return [];
    }

    const workspaces_list = await readDir(`${basedir}/${path}`);
    return Promise.all(workspaces_list.map(workspace=>ejecutarWorkspace(basedir, path, workspace, watch)));
}

async function ejecutarWorkspace(basedir: string, path: string, workspace: string, watch: boolean): Promise<Workspace> {
    const devel = new Workspace({
        nombre: workspace,
        path,
        root: basedir,
        watch,
    });

    return devel.init().then(()=>devel);
}

async function ejecutarServices(ejecucion: IConfigEjecucion, basedir: string, dependencias: Workspace[]): Promise<boolean> {
    const config_global = await cargarConfig(basedir);

    const groups = GRUPOS;
    const workspacesList: Record<string, string[]> = {};

    for (const group of groups) {
        workspacesList[group] = await isDir(`${basedir}/${group}`)
            ? await readDir(`${basedir}/${group}`)
            : [];
    }

    const length = Math.max(
        ...groups.map(group => workspacesList[group].reduce((a, b) => Math.max(a, b.length), 0)),
    );

    if (length==0) {
        return false;
    }

    let i18n: I18N | undefined;
    if (ejecucion.compilar && await isDir(`${basedir}/i18n`)) {
        i18n = new I18N({
            nombre: "i18n",
            root: basedir,
            pad: length,
            global: config_global,
            watch: config_global.workspaces?.i18n?.watch ?? false,
        });
        await i18n.init();
        dependencias.push(i18n);
    }

    // Fase 1: crear todas las instancias de Service (sin iniciar aún)
    const serviciosCreados: {nombre: string, service: Service}[] = [];

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
                watch: ejecucion.watch,
                global: config_global,
            });
            serviciosCreados.push({nombre: workspace, service: devel});
        }
    }

    // Fase 2: registrar dependencias de compilación (build.deps) antes de iniciar
    const serviciosPorNombre = new Map<string, Service>(
        serviciosCreados.map(({nombre, service}) => [nombre, service]),
    );
    await Promise.all(serviciosCreados.map(({service}) => service.inicializarDeps(serviciosPorNombre)));

    // Fase 3: iniciar todos los servicios y conectar hijos de frameworks
    const services = await Promise.all(
        serviciosCreados.map(({service}) =>
            service.init().then(() => {
                for (const dependencia of dependencias) {
                    dependencia.addHijo(service);
                }
                return service;
            }),
        ),
    );

    if (ejecucion.watch) {
        chokidar.watch(`${basedir}/config.workspaces.json`, {
            persistent: true,
        }).on("change", ()=>{
            cargarConfig(basedir)
                .then(async (config_global)=>{
                    for (const actual of services) {
                        actual.updateGlobal(config_global);
                    }
                    if (i18n!=undefined) {
                        i18n.updateGlobal(config_global);
                    }
                })
                .catch((err)=>{
                    Log.error({
                        type: Log.label_base,
                        label: "config.workspaces.json",
                    }, "Error recargando configuración global", err);
                });
        });
    }

    return true;
}
