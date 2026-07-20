/**
 * Editor: José Antonio Jiménez
 * Fecha: Tue, 14 Jul 2026 07:18:57 GMT
 * Hash: 5cce78f7d1f8469a9913da85a84d9e28
 * Versión: 2026.7.14+1-josantoniojimnez
 * Proyecto: https://github.com/meteored-status/svc-logs.git
 */

import {rename} from "node:fs/promises";

import {isDir, readDir} from "../../../utiles/fs";
import {Colors} from "../colors";
import {Comando} from "../comando";
import {Log} from "../log";

/**
 * Corrige conflictos de nombre de fichero conocidos entre distintos sistemas de
 * ficheros (case-sensitive vs. case-insensitive) en los frameworks compartidos.
 *
 * @param basedir - Raíz absoluta del monorepo.
 */
export async function corregirGITs(basedir: string): Promise<void> {
    Log.group({type: Log.label_base, label: "init"}, Colors.colorize([Colors.FgWhite], "Corrigiendo conflictos de GIT"));

    await corregirGIT(basedir, "services-comun", "/", "CHANGELOG.md", ["changelog.md"]);

    Log.groupEnd();
}

/**
 * Corrige un conflicto de nombre de fichero concreto (p.ej. `changelog.md` vs. `CHANGELOG.md`)
 * dentro de un framework, desactivando temporalmente el case-sensitive de git para poder
 * eliminar y renombrar el fichero correctamente.
 *
 * @param basedir - Raíz absoluta del monorepo.
 * @param framework - Nombre del framework dentro de `framework/`.
 * @param subdir  - Subdirectorio dentro del framework donde está el fichero (con `/` inicial y final).
 * @param bueno   - Nombre correcto del fichero.
 * @param malos   - Nombres incorrectos conocidos del fichero.
 */
async function corregirGIT(basedir: string, framework: string, subdir: string, bueno: string, malos: string[]): Promise<void> {
    const dir = `${basedir}/framework/${framework}${subdir}`;
    if (!await isDir(dir)) {
        return;
    }

    let malo: string|undefined;
    const files = await readDir(dir);
    for (const file of malos) {
        if (files.includes(file)) {
            malo = file;
            break;
        }
    }
    if (!malo) {
        // nada que corregir
        return;
    }

    Log.info({type: Log.label_base, label: "init"}, `Corrigiendo ${Colors.colorize([Colors.FgYellow], `${framework}${subdir}${bueno}`)}`);

// desactivamos el case-sensitive de git temporalmente
    {
        const {status, stderr} = await Comando("git", ["config", "core.ignorecase", "false"], {cwd: basedir});
        if (status !== 0) {
            Log.error({type: Log.label_base, label: "init"}, "Error corrigiendo", framework, stderr);
            return;
        }
    }

// eliminamos del repositorio el archivo con el nombre tanto correcto como incorrecto
    for (const file of [bueno, ...malos]) {
        await Comando("git", ["rm", "-r", "--cached", `framework/${framework}${subdir}${file}`], {cwd: basedir});
    }

    {
        const {status} = await Comando("git", ["commit", "-m", `"Corrigiendo archivos conflictivos"`], {cwd: basedir});
        if (status !== 0) {
            // rehabilitamos el case-sensitive de git
            await Comando("git", ["config", "core.ignorecase", "true"], {cwd: basedir});
            return;
        }
    }

// renombramos el archivo incorrecto al correcto
    await rename(`${dir}${malo}`, `${dir}${bueno}`);

// rehabilitamos el case-sensitive de git
    await Comando("git", ["config", "core.ignorecase", "true"], {cwd: basedir});
}
