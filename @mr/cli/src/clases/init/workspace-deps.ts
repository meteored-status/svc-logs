/**
 * Editor: Bixus
 * Fecha: Wed, 23 Sep 2026 09:57:26 GMT
 * Hash: 82f67a8031e0d8540cffd2a80fa39cec
 * Versión: 2026.9.23+3-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

import {isDir, isFile, readDir, readJSON, safeWrite} from "@mr/core-cli/fs";

import type {IPackageJson} from "../packagejson";

/**
 * Un workspace del monorepo: dónde está y cómo se llama.
 *
 * @property dir    - Ruta absoluta del directorio del workspace.
 * @property nombre - `name` de su `package.json`.
 */
interface IWorkspaceLocal {
    dir: string;
    nombre: string;
}

/**
 * Todos los workspaces que declaran los patrones de `workspaces` del `package.json` raíz. Solo se
 * entienden las dos formas que escribe `initBase()`: una ruta literal (`i18n`) y una carpeta con
 * comodín final (`services/*`). La lista es la de `@mr/core/lint/lib/workspaces.js`, que hace lo mismo
 * para `import-blocks`.
 *
 * @param basedir - Raíz absoluta del monorepo.
 * @returns Los workspaces con `package.json` y `name`.
 */
async function workspacesDelMonorepo(basedir: string): Promise<IWorkspaceLocal[]> {
    const {workspaces = []} = await readJSON<IPackageJson>(`${basedir}/package.json`);
    const dirs: string[] = [];
    for (const patron of workspaces) {
        if (!patron.includes("*")) {
            dirs.push(`${basedir}/${patron}`);
        } else if (patron.endsWith("/*") && !patron.slice(0, -2).includes("*") && await isDir(`${basedir}/${patron.slice(0, -2)}`)) {
            for (const entrada of await readDir(`${basedir}/${patron.slice(0, -2)}`)) {
                dirs.push(`${basedir}/${patron.slice(0, -2)}/${entrada}`);
            }
        }
    }
    const salida: IWorkspaceLocal[] = [];
    for (const dir of dirs) {
        if (!await isFile(`${dir}/package.json`)) {
            continue;
        }
        const {name} = await readJSON<IPackageJson>(`${dir}/package.json`).catch(() => ({name: ""}));
        if (name.length > 0) {
            salida.push({dir, nombre: name});
        }
    }
    return salida;
}

/**
 * Pone `workspace:*` en las `devDependencies` que apuntan a otro workspace del mismo monorepo.
 *
 * Con `"*"` (o cualquier rango sin el protocolo `workspace:`) Yarn resuelve el paquete local solo
 * mientras el nombre case con un workspace y la versión con su `version`; si alguna de las dos cosas
 * deja de cumplirse, lo busca en npm, y un paquete público con el mismo nombre que uno de los nuestros
 * entraría sin que nadie lo pidiera. `workspace:*` no tiene esa salida: o es el local, o falla.
 *
 * Recorre **todos** los workspaces de la raíz, no solo los que normaliza `initWorkspace()`
 * (`services/`, `cronjobs/`, `jobs/`, `scripts/`): los casos que había estaban sobre todo en
 * `packages/` y en `framework/`.
 *
 * @param basedir - Raíz absoluta del monorepo.
 * @returns `true` si ha cambiado algún `package.json`, para que el llamante reinstale.
 */
export async function checkWorkspaceDeps(basedir: string): Promise<boolean> {
    const workspaces = await workspacesDelMonorepo(basedir);
    const nombres = new Set(workspaces.map(({nombre}) => nombre));
    let cambio = false;
    for (const {dir} of workspaces) {
        const paquete = await readJSON<IPackageJson>(`${dir}/package.json`);
        let cambiado = false;
        for (const [dependencia, version] of Object.entries(paquete.devDependencies ?? {})) {
            if (nombres.has(dependencia) && !version.startsWith("workspace:")) {
                paquete.devDependencies![dependencia] = "workspace:*";
                cambiado = true;
            }
        }
        if (cambiado) {
            await safeWrite(`${dir}/package.json`, `${JSON.stringify(paquete, null, 2)}\n`, true);
            cambio = true;
        }
    }
    return cambio;
}
