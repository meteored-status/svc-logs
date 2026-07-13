/**
 * Editor: José Antonio Jiménez
 * Fecha: Tue, 14 Jul 2026 07:18:57 GMT
 * Hash: 9bf01d37ec29df1ba310d249ed7773f4
 * Versión: 2026.7.14+1-josantoniojimnez
 * Proyecto: https://github.com/meteored-status/svc-logs.git
 */

import {Runtime} from "@mr/core-dev/manifest/deployment";

import {isFile, readJSON, safeWrite} from "../../../utiles/fs";
import {Colors} from "../colors";
import {Log} from "../log";
import {ManifestWorkspaceLoader} from "../manifest/workspace";
import type {IConfigServices} from "../workspace/service";
import {FrameworkUpdates, sanitizeFrameworkUpdates} from "../workspace/service";

export interface IWorkspaces {
    dir: string;
    workspaces: string[];
}

/**
 * Sanitiza el campo `patch` de `config.workspaces.json`, aceptando únicamente valores
 * con el formato `R<número>` (p.ej. `R1`, `R23`), normalizados a mayúsculas.
 *
 * @param value - Valor bruto leído del fichero de configuración.
 * @returns El patch normalizado, o `undefined` si no tiene un formato válido.
 */
function sanitizePatch(value: unknown): string|undefined {
    if (typeof value !== "string") {
        return undefined;
    }
    const patch = value.trim().toUpperCase();
    if (!/^R\d+$/.test(patch)) {
        return undefined;
    }
    return patch;
}

/**
 * Regenera `config.workspaces.json` con la lista de workspaces disponibles/deshabilitados
 * para `devel`/`packd`, preservando las preferencias del usuario ya existentes
 * (deshabilitados, `i18n`, `services`, `framework.updates`, `patch`).
 *
 * @param basedir    - Raíz absoluta del monorepo.
 * @param workspaces - Agrupación de workspaces por directorio (`cronjobs`, `jobs`, `services`, `scripts`).
 */
export async function initConfig(basedir: string, workspaces: IWorkspaces[]): Promise<void> {
    Log.group({type: Log.label_base, label: "workspaces"}, Colors.colorize([Colors.FgWhite], "Inicializando configuración personal de workspaces"));

    function sort(a: string, b: string): number {
        return a.localeCompare(b);
    }

    const file = `${basedir}/config.workspaces.json`;
    const salida: IConfigServices = {
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
        framework: {
            updates: FrameworkUpdates.all,
        },
    };

    interface IProyecto {
        nombre: string;
        compilable: boolean;
        ejecutable: boolean;
    }

    const proyectos: IProyecto[] = [];
    for (const carpeta of workspaces) {
        for (const nombre of carpeta.workspaces) {
            const {manifest} = new ManifestWorkspaceLoader(`${basedir}/${carpeta.dir}/${nombre}`).loadSync();
            proyectos.push({
                nombre,
                compilable: manifest.deploy.runtime !== Runtime.php,
                ejecutable: manifest.deploy.runtime === Runtime.node,
            });
        }
    }

    const ejecutables = new Set(proyectos.filter(p => p.ejecutable).map(p => p.nombre));
    const compilables = new Set(proyectos.filter(p => p.compilable).map(p => p.nombre));

    if (await isFile(file)) {
        try {
            const config = await readJSON<IConfigServices>(file);
            salida.devel.disabled.push(...config?.devel?.disabled?.filter(actual => ejecutables.has(actual)) ?? []);
            salida.packd.disabled.push(...config?.packd?.disabled?.filter(actual => compilables.has(actual)) ?? []);
            salida.i18n = config.i18n??true;
            salida.services = config.services??{};
            salida.framework = {
                updates: sanitizeFrameworkUpdates(config.framework?.updates),
            };
            salida.patch = sanitizePatch(config.patch);
        } catch (e) {
            // no hacemos nada
        }
    }
    for (const proyecto of proyectos) {
        if (proyecto.ejecutable && !salida.devel.disabled.includes(proyecto.nombre)) {
            salida.devel.available.push(proyecto.nombre);
        }
        if (proyecto.compilable && !salida.packd.disabled.includes(proyecto.nombre)) {
            salida.packd.available.push(proyecto.nombre);
        }
    }

    salida.devel.available.sort(sort);
    salida.devel.available.push("");
    salida.devel.disabled.sort(sort);
    salida.devel.disabled.push("");
    salida.packd.available.sort(sort);
    salida.packd.available.push("");
    salida.packd.disabled.sort(sort);
    salida.packd.disabled.push("");

    await safeWrite(file, JSON.stringify(salida, null, 2), true);

    Log.groupEnd();
}
