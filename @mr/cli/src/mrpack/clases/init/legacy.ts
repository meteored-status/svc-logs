/**
 * Editor: José Antonio Jiménez
 * Fecha: Tue, 14 Jul 2026 07:18:57 GMT
 * Hash: f34612dcd2331e458f5fcff0f2cce76d
 * Versión: 2026.7.14+1-josantoniojimnez
 * Proyecto: https://github.com/meteored-status/svc-logs.git
 */

import {isDir, isFile, unlink} from "../../../utiles/fs";
import {Colors} from "../colors";
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
