/**
 * Editor: José Antonio Jiménez
 * Fecha: Thu, 25 Jun 2026 06:52:42 GMT
 * Hash: 6dcca89484bfdde79c3f1e21c2c9ecb9
 * Versión: 2026.6.25+5-josantoniojimnez
 * Anterior: 2026.6.25+4-josantoniojimnez
 */

import {spawn} from "node:child_process";

import {Deferred} from "services-comun/modules/utiles/promise";
import {isFile, md5Dir, mkdir, readDir, readFileString, safeWrite} from "services-comun/modules/utiles/fs";

import {Colors} from "../colors";
import {Comando} from "../comando";
import {Log} from "../log";
import {Paquete, PaqueteTipo} from "../paquete";
import {install} from "../yarn";

/**
 * Configuración de {@link recompilarCliente}.
 *
 * @property reiniciar    - Si `true` (por defecto), reinicia el proceso tras recompilar.
 * @property skipInstall  - Si `true`, omite el `yarn install` previo a la compilación.
 */
interface IRecompilarClienteConfig {
    reiniciar?: boolean;
    skipInstall?: boolean;
}

// ─── Helpers de dependencias @mr/* ────────────────────────────────────────────

/**
 * Convierte un nombre npm `@mr/*` al formato argumento de {@link add}.
 *
 * - `@mr/core-dev`       → `@mr/core/dev`
 * - `@mr/user-mr-domain` → `@mr/user/mr-domain`
 * - Cualquier otro       → `undefined`
 *
 * @param npmName - Nombre npm del paquete.
 */
function mrNpmAArg(npmName: string): string | undefined {
    const coreMatch = npmName.match(/^@mr\/core-(.+)$/);
    if (coreMatch !== null) {
        return `@mr/core/${coreMatch[1]}`;
    }
    const userMatch = npmName.match(/^@mr\/user-(.+)$/);
    if (userMatch !== null) {
        return `@mr/user/${userMatch[1]}`;
    }
    return undefined;
}

/**
 * Lee el `package.json` de un framework ya instalado y devuelve la lista de sus
 * `devDependencies` de tipo `@mr/*` convertidas al formato argumento de {@link add}
 * (`@mr/core/X`, `@mr/user/X`).
 *
 * @param localDir - Directorio raíz del framework.
 */
export async function leerDepsMrFramework(localDir: string): Promise<string[]> {
    const raw = await readFileString(`${localDir}/package.json`).catch(() => "{}");
    let pkg: {devDependencies?: Record<string, string>};
    try {
        pkg = JSON.parse(raw);
    } catch {
        return [];
    }
    const resultado: string[] = [];
    for (const nombre of Object.keys(pkg.devDependencies ?? {})) {
        const arg = mrNpmAArg(nombre);
        if (arg !== undefined) {
            resultado.push(arg);
        }
    }
    return resultado;
}

// ─── Helpers de workspaces del monorepo ───────────────────────────────────────

/**
 * Expande los patrones de workspaces del `package.json` raíz y devuelve los
 * directorios absolutos que contienen un `package.json`.
 *
 * @param basedir - Raíz absoluta del monorepo.
 */
async function encontrarDirsWorkspace(basedir: string): Promise<string[]> {
    const raw = await readFileString(`${basedir}/package.json`).catch(() => "{}");
    let pkg: {workspaces?: string[]};
    try {
        pkg = JSON.parse(raw);
    } catch {
        return [];
    }

    const dirs: string[] = [];
    for (const pattern of pkg.workspaces ?? []) {
        if (pattern.endsWith("/*")) {
            const parent = `${basedir}/${pattern.slice(0, -2)}`;
            const entries = await readDir(parent).catch(() => [] as string[]);
            for (const entry of entries) {
                const dir = `${parent}/${entry}`;
                if (await isFile(`${dir}/package.json`)) {
                    dirs.push(dir);
                }
            }
        } else {
            const dir = `${basedir}/${pattern}`;
            if (await isFile(`${dir}/package.json`)) {
                dirs.push(dir);
            }
        }
    }
    return dirs;
}

/**
 * Devuelve los directorios de workspaces del monorepo que declaran `npmName`
 * en `dependencies`, `devDependencies` o `peerDependencies`, excluyendo el
 * propio paquete.
 *
 * @param basedir - Raíz absoluta del monorepo.
 * @param npmName - Nombre npm del paquete a buscar (p.ej. `@mr/core-network`).
 */
export async function encontrarWorkspacesConDep(basedir: string, npmName: string): Promise<string[]> {
    const dirs = await encontrarDirsWorkspace(basedir);
    const resultado: string[] = [];

    await Promise.all(dirs.map(async dir => {
        const raw = await readFileString(`${dir}/package.json`).catch(() => "{}");
        let pkg: {
            name?: string;
            dependencies?: Record<string, string>;
            devDependencies?: Record<string, string>;
            peerDependencies?: Record<string, string>;
        };
        try {
            pkg = JSON.parse(raw);
        } catch {
            return;
        }
        if (pkg.name === npmName) {
            return;
        }
        const todas = {
            ...(pkg.dependencies ?? {}),
            ...(pkg.devDependencies ?? {}),
            ...(pkg.peerDependencies ?? {}),
        };
        if (todas[npmName] !== undefined) {
            resultado.push(dir);
        }
    }));

    return resultado;
}

/**
 * Elimina `npmNames` de las `devDependencies` de los workspaces consumidores
 * del monorepo (`services/`, `cronjobs/`, `jobs/`, `packages/`).
 *
 * @param basedir  - Raíz absoluta del monorepo.
 * @param npmNames - Nombres npm de los paquetes a eliminar de `devDependencies`.
 */
export async function limpiarDevDepsConsumidores(basedir: string, npmNames: string[]): Promise<void> {
    if (npmNames.length === 0) {
        return;
    }
    const aNombres = new Set(npmNames);
    const patronesCons = ["services", "cronjobs", "jobs", "packages"];
    const dirsCons: string[] = [];

    for (const patron of patronesCons) {
        const parent = `${basedir}/${patron}`;
        const entries = await readDir(parent).catch(() => [] as string[]);
        for (const entry of entries) {
            const dir = `${parent}/${entry}`;
            if (await isFile(`${dir}/package.json`)) {
                dirsCons.push(dir);
            }
        }
    }

    await Promise.all(dirsCons.map(async dir => {
        const pkgPath = `${dir}/package.json`;
        const raw = await readFileString(pkgPath).catch(() => null);
        if (raw === null) {
            return;
        }
        let pkg: {devDependencies?: Record<string, string>};
        try {
            pkg = JSON.parse(raw);
        } catch {
            return;
        }

        let cambiado = false;
        for (const nombre of aNombres) {
            if (pkg.devDependencies?.[nombre] !== undefined) {
                delete pkg.devDependencies![nombre];
                cambiado = true;
            }
        }
        if (!cambiado) {
            return;
        }
        if (Object.keys(pkg.devDependencies ?? {}).length === 0) {
            delete pkg.devDependencies;
        }
        await safeWrite(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);
    }));
}

// ──────────────────────────────────────────────────────────────────────────────

export async function add(basedir: string, frameworks: string[], visitados: Set<string> = new Set()): Promise<boolean> {
    let cambio = false;

    for (const fw of frameworks) {
        if (visitados.has(fw)) {
            continue;
        }
        visitados.add(fw);

        let tipo: PaqueteTipo;
        let npmName: string;
        let localDir: string;

        if (fw.startsWith("@mr/core/")) {
            const name = fw.slice("@mr/core/".length);
            tipo = PaqueteTipo.core;
            npmName = `@mr/core-${name}`;
            localDir = `${basedir}/@mr/core/${name}`;
        } else if (fw.startsWith("@mr/user/")) {
            const name = fw.slice("@mr/user/".length);
            tipo = PaqueteTipo.user;
            npmName = `@mr/user-${name}`;
            localDir = `${basedir}/@mr/user/${name}`;
        } else {
            tipo = PaqueteTipo.legacy;
            npmName = fw;
            localDir = `${basedir}/framework/${fw}`;
        }

        if (await isFile(`${localDir}/package.json`)) {
            continue;
        }

        Log.info({type: Log.label_base, label: "framework"}, `Añadiendo framework ${Colors.colorize([Colors.FgMagenta], fw)}...`);
        await mkdir(localDir, true);
        await safeWrite(`${localDir}/package.json`, `${JSON.stringify({
            name: npmName,
            version: "0.0.0+0-new",
            config: {
                subible: true,
                tipo,
            },
        }, null, 2)}\n`);
        if (await pullPackage(localDir, true)) {
            cambio = true;
        }

        // Resolver dependencias @mr/* declaradas en el framework recién instalado.
        const depsFw = await leerDepsMrFramework(localDir);
        const faltantes = depsFw.filter(d => !visitados.has(d));
        if (faltantes.length > 0) {
            Log.info({type: Log.label_base, label: "framework"}, `  → Verificando dependencias de ${npmName}: ${faltantes.join(", ")}`);
            if (await add(basedir, faltantes, visitados)) {
                cambio = true;
            }
        }
    }

    return cambio;
}

export async function getClienteHash(basedir: string): Promise<string> {
    return readFileString(`${basedir}/@mr/cli/bin/hash.md5`).catch(() => "");
}

export async function getClienteMD5(basedir: string): Promise<string> {
    return md5Dir(`${basedir}/@mr/cli/bin/min`);
}

/**
 * Devuelve el hash anterior si el cliente está desactualizado, o `undefined` si está al día.
 *
 * @param basedir - Raíz absoluta del monorepo.
 * @returns Hash md5 almacenado en `bin/hash.md5` si difiere del actual, o `undefined`.
 */
export async function checkCliente(basedir: string): Promise<string | undefined> {
    if (await isFile(`${basedir}/@mr/cli/bin/hash.md5`)) {
        const [hash, md5] = await Promise.all([
            getClienteHash(basedir),
            getClienteMD5(basedir),
        ]);
        if (hash !== md5) {
            return hash;
        }
    }

    return undefined;
}

export async function recompilarCliente(basedir: string, hash: string, config: IRecompilarClienteConfig = {}): Promise<void> {
    const {reiniciar = true, skipInstall = false} = config;
    if (!skipInstall) {
        await install(basedir, {verbose: false, optimize: true});
    }

    Log.info({type: Log.label_base, label: "framework"}, Colors.colorize([Colors.FgGreen, Colors.Bright], "Compilando nueva versión del cliente"));
    await Comando("yarn", ["run", "compile"], {cwd: `${basedir}/@mr/cli`});
    const md5 = await md5Dir(`${basedir}/@mr/cli/bin/min`);
    await safeWrite(`${basedir}/@mr/cli/bin/hash.md5`, md5, true);

    if (md5 === hash || !reiniciar) {
        return;
    }

    Log.info({type: Log.label_base, label: "framework"}, Colors.colorize([Colors.FgYellow, Colors.Bright], "Reiniciando..."));
    Log.groupEnd();
    const child = spawn("yarn", ["mrpack", ...process.argv.slice(2)], {
        stdio: "inherit",
        shell: process.platform === "win32",
    });
    const promesa = new Deferred<number>();
    child.on("exit", (code) => {
        promesa.resolve(code ?? 0);
    });
    await promesa.promise;
    process.exit();
}

export async function getAutor(): Promise<string> {
    const local = await Comando("git", ["config", "user.name"]).catch(() => undefined);
    const autorLocal = local?.stdout.trim() ?? "";
    if (local?.status === 0 && autorLocal.length > 0) {
        return autorLocal;
    }

    const global = await Comando("git", ["config", "--global", "user.name"]).catch(() => undefined);
    const autorGlobal = global?.stdout.trim() ?? "";
    if (global?.status === 0 && autorGlobal.length > 0) {
        return autorGlobal;
    }

    const autorEnv = (process.env["GIT_AUTHOR_NAME"] ?? process.env["USERNAME"] ?? "").trim();
    if (autorEnv.length > 0) {
        return autorEnv;
    }

    Log.error({type: Log.label_base, label: "framework"}, Colors.colorize([Colors.FgRed], "No se puede obtener el usuario de git"));
    Log.error({type: Log.label_base, label: "framework"}, Colors.colorize([Colors.FgYellow], "Configura user.name y reintenta:"));
    Log.error({type: Log.label_base, label: "framework"}, Colors.colorize([Colors.FgCyan], "git config --global user.name \"Tu Nombre\""));
    Log.groupEnd();
    throw new Error("No se puede obtener el usuario de git");
}

/**
 * Descarga y aplica la actualización de un paquete individual dado su directorio.
 * Usado internamente por `mrpack init` para bootstrap de paquetes de core.
 *
 * @param dir    - Ruta absoluta al directorio del paquete.
 * @param forzar - Si `true`, aplica la actualización sin confirmación interactiva.
 * @returns `true` si se aplicó algún cambio.
 */
export async function pullPackage(dir: string, forzar: boolean): Promise<boolean> {
    const paquete = await Paquete.build(dir);
    return paquete.pull(forzar);
}
