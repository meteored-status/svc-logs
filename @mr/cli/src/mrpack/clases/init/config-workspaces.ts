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
import {existeI18n} from "../config/datos";
import {Log} from "../log";
import {ManifestWorkspaceLoader} from "../manifest/workspace";
import type {GrupoWorkspace, IConfigServices, IConfigWorkspaces, IConfigWorkspacesI18n, IWorkspaceFlags} from "../workspace/service";
import {FrameworkUpdates, grupoDeploy, sanitizeFrameworkUpdates} from "../workspace/service";

export interface IWorkspaces {
    dir: string;
    workspaces: string[];
}

/**
 * Sanitiza el campo `framework.patch` de `config.workspaces.json`, aceptando únicamente
 * valores con el formato `R<número>` (p.ej. `R1`, `R23`), normalizados a mayúsculas.
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

/** Forma de una lista `available`/`disabled` del formato antiguo (previo a `workspaces`). */
interface ILegacyLista {
    available?: string[];
    disabled?: string[];
}

/**
 * Flags de un workspace dentro de `workspaces` aceptando tanto los nombres vigentes
 * (`compilar`/`ejecutar`) como los del formato intermedio (`packd`/`devel`, usado brevemente
 * antes de renombrarlos). Se usa únicamente para leer y migrar ficheros existentes.
 */
interface ILegacyWorkspaceFlags {
    compilar?: boolean;
    ejecutar?: boolean;
    packd?: boolean;
    devel?: boolean;
}

/** `workspaces` con flags en cualquiera de los dos formatos aceptados por {@link ILegacyWorkspaceFlags}. */
interface ILegacyConfigWorkspaces {
    i18n?: IConfigWorkspacesI18n;
    browser?: Record<string, ILegacyWorkspaceFlags>;
    cronjobs?: Record<string, ILegacyWorkspaceFlags>;
    jobs?: Record<string, ILegacyWorkspaceFlags>;
    services?: Record<string, ILegacyWorkspaceFlags>;
}

/**
 * Forma permisiva de `config.workspaces.json` aceptando tanto el formato vigente
 * (`workspaces` con flags `compilar`/`ejecutar`) como los formatos previos: el intermedio
 * (`workspaces` con flags `packd`/`devel`) y el original (`devel`/`packd` con listas
 * `available`/`disabled` a nivel raíz, y `services` como mapa de variables de entorno ya
 * eliminado y sin uso). También acepta `patch` a nivel raíz (ubicación previa a
 * `framework.patch`). Se usa únicamente para leer y migrar ficheros existentes.
 */
interface ILegacyConfigServices {
    workspaces?: ILegacyConfigWorkspaces;
    devel?: ILegacyLista;
    packd?: ILegacyLista;
    i18n?: boolean;
    framework?: {patch?: unknown; updates?: unknown};
    patch?: unknown;
}

/**
 * Busca los flags (en cualquiera de los formatos aceptados) de un workspace por nombre en
 * cualquiera de los grupos de `workspaces`.
 *
 * @param workspaces - `workspaces` leído del fichero previo.
 * @param nombre     - Nombre del workspace a buscar.
 * @returns Flags encontrados, o un objeto vacío si el workspace no está configurado.
 */
function buscarLegacy(workspaces: ILegacyConfigWorkspaces|undefined, nombre: string): ILegacyWorkspaceFlags {
    return workspaces?.browser?.[nombre]
        ?? workspaces?.cronjobs?.[nombre]
        ?? workspaces?.jobs?.[nombre]
        ?? workspaces?.services?.[nombre]
        ?? {};
}

/**
 * Obtiene los flags previos (`compilar`/`ejecutar`) de un workspace, aceptando el fichero ya
 * migrado al formato vigente, el formato intermedio (`packd`/`devel` dentro de `workspaces`)
 * o el formato original (`devel.disabled`/`packd.disabled` a nivel raíz).
 *
 * @param anterior - Configuración previa leída de `config.workspaces.json` (o `undefined` si no existía).
 * @param nombre   - Nombre del workspace.
 * @returns Flags previos del workspace.
 */
function flagsAnteriores(anterior: ILegacyConfigServices|undefined, nombre: string): IWorkspaceFlags {
    if (anterior === undefined) {
        return {};
    }
    if (anterior.workspaces !== undefined) {
        const legacy = buscarLegacy(anterior.workspaces, nombre);
        const flags: IWorkspaceFlags = {};
        const compilar = legacy.compilar ?? legacy.packd;
        const ejecutar = legacy.ejecutar ?? legacy.devel;
        if (compilar !== undefined) {
            flags.compilar = compilar;
        }
        if (ejecutar !== undefined) {
            flags.ejecutar = ejecutar;
        }
        return flags;
    }
    const flags: IWorkspaceFlags = {};
    if (anterior.devel !== undefined) {
        flags.ejecutar = !(anterior.devel.disabled?.includes(nombre) ?? false);
    }
    if (anterior.packd !== undefined) {
        flags.compilar = !(anterior.packd.disabled?.includes(nombre) ?? false);
    }
    return flags;
}

/**
 * Obtiene la configuración previa de `workspaces.i18n`, aceptando tanto el fichero ya migrado
 * (`workspaces.i18n.enabled`/`.watch`) como el formato original (`i18n: boolean` a nivel raíz,
 * que solo cubría lo equivalente a `enabled`).
 *
 * @param anterior - Configuración previa leída de `config.workspaces.json` (o `undefined` si no existía).
 * @returns Flags previos de `workspaces.i18n`.
 */
function i18nAnterior(anterior: ILegacyConfigServices|undefined): IConfigWorkspacesI18n {
    if (anterior?.workspaces?.i18n !== undefined) {
        return anterior.workspaces.i18n;
    }
    return {enabled: anterior?.i18n};
}

/**
 * Regenera `config.workspaces.json` con los workspaces del proyecto agrupados por
 * `deploy.type` (`workspaces.browser`/`.cronjobs`/`.jobs`/`.services`), preservando las
 * preferencias del usuario ya existentes (flags `compilar`/`ejecutar` por workspace,
 * `workspaces.i18n`, `framework.patch`, `framework.updates`). Migra automáticamente tanto el
 * formato original (`devel`/`packd` con listas `available`/`disabled` a nivel raíz, e
 * `i18n: boolean` también a nivel raíz) como el intermedio (`packd`/`devel` por workspace
 * dentro de `workspaces`) si el fichero todavía no ha sido migrado al formato vigente.
 * `workspaces.i18n` se añade como primera propiedad de `workspaces`, y solo si el proyecto
 * tiene workspace de internacionalización. La propiedad `services` (mapa de variables de
 * entorno, sin uso real) ya no se genera ni se preserva. `patch` a nivel raíz (ubicación
 * previa a `framework.patch`) se migra automáticamente a su nueva ubicación.
 *
 * @param basedir    - Raíz absoluta del monorepo.
 * @param workspaces - Agrupación de workspaces por directorio (`cronjobs`, `jobs`, `services`, `scripts`).
 */
export async function initConfig(basedir: string, workspaces: IWorkspaces[]): Promise<void> {
    Log.group({type: Log.label_base, label: "workspaces"}, Colors.colorize([Colors.FgWhite], "Inicializando configuración personal de workspaces"));

    const file = `${basedir}/config.workspaces.json`;

    interface IProyecto {
        nombre: string;
        grupo: GrupoWorkspace|undefined;
        compilable: boolean;
        ejecutable: boolean;
    }

    const proyectos: IProyecto[] = [];
    for (const carpeta of workspaces) {
        for (const nombre of carpeta.workspaces) {
            const {manifest} = new ManifestWorkspaceLoader(`${basedir}/${carpeta.dir}/${nombre}`).loadSync();
            proyectos.push({
                nombre,
                grupo: grupoDeploy(manifest.deploy.type),
                compilable: manifest.deploy.runtime !== Runtime.php,
                ejecutable: manifest.deploy.runtime === Runtime.node,
            });
        }
    }

    let anterior: ILegacyConfigServices|undefined;
    if (await isFile(file)) {
        try {
            anterior = await readJSON<ILegacyConfigServices>(file);
        } catch (e) {
            // no hacemos nada
        }
    }

    function sort(a: string, b: string): number {
        return a.localeCompare(b);
    }

    const workspacesSalida: IConfigWorkspaces = {};
    if (await existeI18n(basedir)) {
        const previas = i18nAnterior(anterior);
        workspacesSalida.i18n = {
            enabled: previas.enabled ?? true,
            watch: previas.watch ?? false,
        };
    }
    for (const proyecto of proyectos) {
        if (proyecto.grupo === undefined || (!proyecto.compilable && !proyecto.ejecutable)) {
            continue;
        }
        const previas = flagsAnteriores(anterior, proyecto.nombre);
        const flags: IWorkspaceFlags = {};
        if (proyecto.compilable) {
            flags.compilar = previas.compilar ?? true;
        }
        if (proyecto.ejecutable) {
            flags.ejecutar = previas.ejecutar ?? true;
        }
        (workspacesSalida[proyecto.grupo] ??= {})[proyecto.nombre] = flags;
    }
    const GRUPOS_WORKSPACE: GrupoWorkspace[] = ["browser", "cronjobs", "jobs", "services"];
    for (const grupo of GRUPOS_WORKSPACE) {
        const bucket = workspacesSalida[grupo];
        if (bucket === undefined) {
            continue;
        }
        workspacesSalida[grupo] = Object.fromEntries(
            Object.entries(bucket).sort(([a], [b]) => sort(a, b)),
        );
    }

    const salida: IConfigServices = {
        workspaces: workspacesSalida,
        framework: {
            patch: sanitizePatch(anterior?.framework?.patch ?? anterior?.patch),
            updates: sanitizeFrameworkUpdates(anterior?.framework?.updates),
        },
    };

    await safeWrite(file, JSON.stringify(salida, null, 2), true);

    Log.groupEnd();
}
