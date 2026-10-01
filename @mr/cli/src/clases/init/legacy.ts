/**
 * Editor: Bixus
 * Fecha: Wed, 23 Sep 2026 08:46:26 GMT
 * Hash: 4fc29cad1476039644814dc6e9e66111
 * Versión: 2026.9.23+2-bixus
 * Anterior: 2026.9.7+1-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

import {isDir, isFile, unlink} from "@mr/core-cli/fs";
import {Colors} from "@mr/core-cli/colors";

import {Log} from "../log";

/**
 * Elimina restos de directorios/ficheros de frameworks legacy que ya no se usan.
 *
 * @param basedir - Raíz absoluta del monorepo.
 */
export async function limpiarLegacy(basedir: string): Promise<void> {
    Log.group({type: Log.label_base, label: "init"}, Colors.colorize([Colors.FgWhite], "Limpiando frameworks legacy"));

    await limpiarLegacyEjecutar(basedir, "services-comun", ["tools"]);

    Log.groupEnd();
}

async function limpiarLegacyEjecutar(basedir: string, framework: string, items: string[]): Promise<void> {
    for (const item of items) {
        const dir = `${basedir}/framework/${framework}/${item}`;
        if (await isFile(dir) || await isDir(dir)) {
            Log.info({type: Log.label_base, label: "init"}, `Limpiando ${Colors.colorize([Colors.FgYellow], `${framework}/${item}`)}`);
            await unlink(dir);
        }
    }
}
