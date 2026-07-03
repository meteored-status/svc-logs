/**
 * Editor: José Antonio Jiménez
 * Fecha: Fri, 03 Jul 2026 07:46:10 GMT
 * Hash: 034c04338e1615ae50d649d5a877733e
 * Versión: 2026.7.3+2-josantoniojimnez
 * Anterior: 2026.7.2+2-josantoniojimnez
 * Proyecto: https://github.com/meteored-status/svc-logs.git
 */

import {diff3Merge} from "node-diff3";

import {Colors} from "services-comun/modules/utiles/colors";
import {warning} from "services-comun/modules/utiles/log";

/**
 * Una sección en conflicto del merge 3-way, con las tres versiones enfrentadas.
 *
 * @property local  - Líneas de la versión local (modificaciones del usuario).
 * @property base   - Líneas de la versión base (ancestro común).
 * @property remote - Líneas de la versión remota (nueva versión del paquete).
 */
export interface IConflictoBloque {
    local: string[];
    base: string[];
    remote: string[];
}

/**
 * Fusiona tres versiones de un fichero usando diff3.
 *
 * @param base     - Versión base (ancestro común, último publicado).
 * @param version1 - Versión local (modificaciones del usuario).
 * @param version2 - Versión remota (nueva versión del paquete).
 * @param filename - Nombre del fichero (para el mensaje de aviso).
 * @returns Texto fusionado, indicador de si hubo sección(es) en conflicto y el detalle de cada bloque en conflicto.
 */
export default function merge3(base: string, version1: string, version2: string, filename: string): {text: string; conflict: boolean; bloques: IConflictoBloque[]} {
    const baseLines = base.split('\n');
    const version1Lines = version1.split('\n');
    const version2Lines = version2.split('\n');

    const mergeResult = diff3Merge(version1Lines, baseLines, version2Lines);

    let conflict = false;
    const salida: string[] = [];
    const bloques: IConflictoBloque[] = [];
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
            bloques.push({local: bloque.conflict.a, base: bloque.conflict.o, remote: bloque.conflict.b});
            if (filename!=undefined) {
                warning(` - Conflicto       ${Colors.colorize([Colors.FgRed, Colors.Bright], filename)}`);
            }
        }
    }

    return {text: salida.join('\n'), conflict, bloques};
}
