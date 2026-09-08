/**
 * Editor: Bixus
 * Fecha: Mon, 07 Sep 2026 13:12:27 GMT
 * Hash: 75fa56ef21b99d8b85960d5c2ff9fa56
 * Versión: 2026.9.7+1-bixus
 * Anterior: 2026.7.14+1-josantoniojimnez
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
