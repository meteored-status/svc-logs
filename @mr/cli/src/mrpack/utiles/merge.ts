/**
 * Editor: José Antonio Jiménez
 * Fecha: Fri, 15 May 2026 12:09:04 GMT
 * Hash: 4086979e1a0901cb46a3173012001f6e
 */

import diff3Merge from "diff3";

import {Colors} from "services-comun/modules/utiles/colors";
import {warning} from "services-comun/modules/utiles/log";

/**
 * Fusiona tres versiones de un fichero usando diff3.
 *
 * @param base     - Versión base (ancestro común, último publicado).
 * @param version1 - Versión local (modificaciones del usuario).
 * @param version2 - Versión remota (nueva versión del paquete).
 * @param filename - Nombre del fichero (para el mensaje de aviso).
 * @returns Texto fusionado e indicador de si hubo sección(es) en conflicto.
 */
export default function merge3(base: string, version1: string, version2: string, filename: string): {text: string; conflict: boolean} {
    const baseLines = base.split('\n');
    const version1Lines = version1.split('\n');
    const version2Lines = version2.split('\n');

    const mergeResult = diff3Merge(version1Lines, baseLines, version2Lines);

    let conflict = false;
    const salida: string[] = [];
    for (const bloque of mergeResult) {
        if (bloque.ok!=undefined) {
            salida.push(...bloque.ok);
        } else if (bloque.conflict!=undefined) {
            conflict = true;
            salida.push(`<<<<<<< LOCAL`);
            salida.push(...bloque.conflict.a);
            salida.push(`||||||| BASE`);
            salida.push(...bloque.conflict.o);
            salida.push(`=======`);
            salida.push(...bloque.conflict.b);
            salida.push(`>>>>>>> REMOTE`);
            if (filename!=undefined) {
                warning(` - Conflicto       ${Colors.colorize([Colors.FgRed, Colors.Bright], filename)}`);
            }
        }
    }

    return {text: salida.join('\n'), conflict};
}
