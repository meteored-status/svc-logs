import {isDir, isFile, unlink} from "services-comun/modules/utiles/fs";

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
