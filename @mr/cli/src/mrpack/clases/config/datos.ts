/**
 * Editor: José Antonio Jiménez
 * Fecha: Tue, 30 Jun 2026 10:32:49 GMT
 * Hash: 06cc72a5d106ead30e677175d73770fc
 * Versión: 2026.6.30+3-josantoniojimnez
 * Anterior: 2026.6.30+2-josantoniojimnez
 * Proyecto: https://github.com/alpred/meteored-svc-ads.git
 */

import {isDir, isFile, readDir, readJSON, safeWrite} from "services-comun/modules/utiles/fs";

import {Runtime} from "@mr/core-dev/manifest/deployment";

import {type IConfigServices} from "../workspace/service";
import {ManifestWorkspaceLoader} from "../manifest/workspace";

/** Grupos de workspaces ejecutables/compilables gestionados por `config.workspaces.json`. */
const GRUPOS = ["cronjobs", "jobs", "scripts", "services"] as const;

/**
 * Capacidades de compilación/ejecución de un workspace, derivadas de su `mrpack.json`.
 *
 * @property nombre     - Nombre del workspace.
 * @property compilable - `true` si el workspace puede compilarse (runtime ≠ "php").
 * @property ejecutable - `true` si el workspace puede ejecutarse (framework === "meteored" y runtime === "node").
 */
export interface IInfoWorkspace {
    nombre: string;
    compilable: boolean;
    ejecutable: boolean;
}


/**
 * Ruta absoluta del fichero de configuración personal de workspaces.
 *
 * @param basedir - Raíz absoluta del monorepo.
 * @returns Ruta del fichero `config.workspaces.json`.
 */
function rutaConfig(basedir: string): string {
    return `${basedir}/config.workspaces.json`;
}

/**
 * Carga la configuración personal de workspaces, devolviendo valores por defecto si el
 * fichero no existe o no es válido.
 *
 * @param basedir - Raíz absoluta del monorepo.
 * @returns Configuración leída de `config.workspaces.json`.
 */
export async function cargarConfig(basedir: string): Promise<IConfigServices> {
    return readJSON<IConfigServices>(rutaConfig(basedir)).catch(() => ({
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

/**
 * Normaliza una lista de nombres de workspace: elimina duplicados y vacíos, ordena
 * alfabéticamente y añade el centinela `""` final (convención de `config.workspaces.json`).
 *
 * @param lista - Lista de nombres a normalizar.
 * @returns Lista normalizada con el centinela final.
 */
function normalizar(lista: string[]): string[] {
    const limpio = [...new Set(lista.filter(nombre => nombre.length > 0))].sort((a, b) => a.localeCompare(b));
    limpio.push("");
    return limpio;
}

/**
 * Persiste la configuración personal de workspaces en `config.workspaces.json`,
 * normalizando las listas `devel` y `packd`.
 *
 * @param basedir - Raíz absoluta del monorepo.
 * @param config  - Configuración a guardar.
 */
export async function guardarConfig(basedir: string, config: IConfigServices): Promise<void> {
    const salida: IConfigServices = {
        ...config,
        devel: {
            available: normalizar(config.devel.available),
            disabled: normalizar(config.devel.disabled),
        },
        packd: {
            available: normalizar(config.packd.available),
            disabled: normalizar(config.packd.disabled),
        },
    };
    await safeWrite(rutaConfig(basedir), JSON.stringify(salida, null, 2), true);
}

/**
 * Lista los workspaces válidos (con `package.json`) de un grupo concreto,
 * devolviendo también la ruta absoluta del directorio de cada uno.
 *
 * @param basedir - Raíz absoluta del monorepo.
 * @param grupo   - Nombre del directorio de grupo (p.ej. `services`).
 * @returns Pares `{nombre, dir}` de los workspaces válidos del grupo.
 */
async function listarGrupo(basedir: string, grupo: string): Promise<{nombre: string; dir: string}[]> {
    if (!await isDir(`${basedir}/${grupo}`)) {
        return [];
    }
    const entradas = await readDir(`${basedir}/${grupo}`);
    const validos: {nombre: string; dir: string}[] = [];
    for (const entrada of entradas) {
        const dir = `${basedir}/${grupo}/${entrada}`;
        if (await isFile(`${dir}/package.json`)) {
            validos.push({nombre: entrada, dir});
        }
    }
    return validos;
}

/**
 * Lee el `mrpack.json` de un workspace usando `ManifestWorkspaceLoader` y devuelve
 * sus capacidades de compilación y ejecución (mismas reglas que `Service`):
 *
 * - `compilable`: `false` si `deploy.runtime === Runtime.php`.
 * - `ejecutable`: `false` si `deploy.runtime` es `browser`, `cfworker` o `php`.
 *   Los workspaces con `deploy.runtime === Runtime.node` son ejecutables independientemente
 *   del framework (`meteored` o `nextjs`).
 *
 * Si el fichero no existe se aplican los defaults del loader, que producen `compilable = true`
 * y `ejecutable = true`.
 *
 * @param dir - Directorio absoluto del workspace.
 * @returns Capacidades `{compilable, ejecutable}` del workspace.
 */
function leerCapacidades(dir: string): {compilable: boolean; ejecutable: boolean} {
    const {manifest} = new ManifestWorkspaceLoader(dir).loadSync();
    return {
        compilable: manifest.deploy.runtime !== Runtime.php,
        ejecutable: manifest.deploy.runtime === Runtime.node,
    };
}

/**
 * Descubre todos los workspaces gestionables (de `cronjobs`, `jobs`, `scripts` y `services`)
 * y los enriquece con sus capacidades de compilación y ejecución.
 *
 * @param basedir - Raíz absoluta del monorepo.
 * @returns Lista de `IInfoWorkspace` únicos, ordenados alfabéticamente por nombre.
 */
export async function listarWorkspacesConInfo(basedir: string): Promise<IInfoWorkspace[]> {
    const vistos = new Set<string>();
    const resultado: IInfoWorkspace[] = [];
    for (const grupo of GRUPOS) {
        for (const {nombre, dir} of await listarGrupo(basedir, grupo)) {
            if (vistos.has(nombre)) {
                continue;
            }
            vistos.add(nombre);
            const {compilable, ejecutable} = leerCapacidades(dir);
            resultado.push({nombre, compilable, ejecutable});
        }
    }
    resultado.sort((a, b) => a.nombre.localeCompare(b.nombre));
    return resultado;
}

/**
 * Indica si el monorepo incluye el workspace de internacionalización `i18n`.
 *
 * @param basedir - Raíz absoluta del monorepo.
 * @returns `true` si existe el directorio `i18n`.
 */
export async function existeI18n(basedir: string): Promise<boolean> {
    return isDir(`${basedir}/i18n`);
}

