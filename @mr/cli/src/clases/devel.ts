/**
 * Editor: alexCG
 * Fecha: Tue, 20 Oct 2026 07:44:09 GMT
 * Hash: 73c1cec1a71198ae40fa81921ed0c82c
 * Versión: 2026.10.20+1-alexcg
 * Anterior: 2026.9.23+2-bixus
 * Proyecto: https://github.com/alpred/meteored-svc-amateur.git
 */

import chokidar from "chokidar";

import {PromiseDelayed} from "services-comun/modules/utiles/promise";
import {isDir, readDir} from "@mr/core-cli/fs";

import {GRUPOS, cargarConfig} from "./config/datos";
import {actualizarTodo} from "./framework";
import {init} from "./init";
import {aplicarPatches} from "./patches";
import {I18N} from "./workspace/i18n";
import {sanitizeFrameworkUpdates, Service} from "./workspace/service";
import {Log} from "./log";
import {prepararEjecucion} from "./pubsub";
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
 * @property pubsub   - Si `true` (y `ejecutar`), da de alta la topología de Pub/Sub de los `mrpack.pubsub.ts` en el emulador
 *   local, lanza los servicios contra él y lo vigila. Si algo de eso falla, no se lanza nada.
 * @property solo     - Si se define, solo se ejecutan los workspaces con esos nombres, aunque `config.workspaces.json`
 *   diga otra cosa.
 */
export interface IConfigEjecucion {
    compilar: boolean;
    ejecutar: boolean;
    forzar: boolean;
    watch: boolean;
    pubsub: boolean;
    solo?: string[];
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

    const workspacesList = await readDir(`${basedir}/${path}`);
    return Promise.all(workspacesList.map(workspace=>ejecutarWorkspace(basedir, path, workspace, watch)));
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
    const configGlobal = await cargarConfig(basedir);

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
            global: configGlobal,
            watch: configGlobal.workspaces?.i18n?.watch ?? false,
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
                global: configGlobal,
                solo: ejecucion.solo,
            });
            serviciosCreados.push({nombre: workspace, service: devel});
        }
    }

    // Fase 2: registrar dependencias de compilación (build.deps) antes de iniciar
    const serviciosPorNombre = new Map<string, Service>(
        serviciosCreados.map(({nombre, service}) => [nombre, service]),
    );
    await Promise.all(serviciosCreados.map(({service}) => service.inicializarDeps(serviciosPorNombre)));

    // Antes de la fase 3, cuando ya existen todos los Service pero todavía no se ha lanzado nada: si algo de lo que se ha
    // pedido no se puede cumplir, no se lanza nada (y con `--pubsub`, nunca se ejecuta contra Google Cloud sin avisar).
    if (!await comprobarSolo(ejecucion, serviciosCreados)) {
        process.exitCode = 1;
        return false;
    }
    if (ejecucion.pubsub && !ejecucion.ejecutar) {
        Log.info({type: Log.label_base, label: "devel"}, "-p/--pubsub solo tiene efecto al ejecutar (-e): se ignora");
    } else if (ejecucion.pubsub) {
        if (!await prepararEjecucion(basedir, serviciosCreados.map(({service}) => service))) {
            process.exitCode = 1;
            return false;
        }
    }

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
                .then(async (configGlobal)=>{
                    for (const actual of services) {
                        actual.updateGlobal(configGlobal);
                    }
                    if (i18n!=undefined) {
                        i18n.updateGlobal(configGlobal);
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

/**
 * Comprueba que todo lo que pide `--solo` es un workspace ejecutable.
 *
 * Sin `--solo` no hay nada que comprobar. Con `--solo` pero sin `-e` no tiene efecto y solo se avisa.
 *
 * @param ejecucion - Opciones de `devel`.
 * @param servicios - Todos los servicios del monorepo, ya creados.
 * @returns `false` si algún nombre no es un workspace ejecutable: ya se ha mostrado el error con los que sí lo son.
 */
async function comprobarSolo(ejecucion: IConfigEjecucion, servicios: {nombre: string, service: Service}[]): Promise<boolean> {
    if (ejecucion.solo===undefined) {
        return true;
    }
    if (!ejecucion.ejecutar) {
        Log.info({type: Log.label_base, label: "devel"}, "--solo solo tiene efecto al ejecutar (-e): se ignora");
        return true;
    }

    const ejecutables = (await Promise.all(servicios.map(async ({nombre, service})=>await service.esEjecutable() ? nombre : undefined)))
        .filter((nombre): nombre is string=>nombre!==undefined)
        .sort();
    const desconocidos = ejecucion.solo.filter(nombre=>!ejecutables.includes(nombre));
    if (desconocidos.length===0) {
        return true;
    }

    Log.error({type: Log.label_base, label: "devel"}, `--solo: ${desconocidos.map(nombre=>`"${nombre}"`).join(", ")} no ${desconocidos.length===1 ? "es un workspace ejecutable" : "son workspaces ejecutables"}. No se lanza nada. Disponibles: ${ejecutables.join(", ")}`);
    return false;
}
