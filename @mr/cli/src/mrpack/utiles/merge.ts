import diff3Merge from "diff3";

import {Colors} from "services-comun/modules/utiles/colors";
import {Fecha} from "services-comun/modules/utiles/fecha";
import {warning} from "services-comun/modules/utiles/log";

export default function merge3(base: string, version1: string, version2: string, filename: string): string {
    const baseLines = base.split('\n');
    const version1Lines = version1.split('\n');
    const version2Lines = version2.split('\n');

    const mergeResult = diff3Merge(version1Lines, baseLines, version2Lines);

    const salida: string[] = [];
    for (const bloque of mergeResult) {
        if (bloque.ok!=undefined) {
            salida.push(...bloque.ok);
        } else if (bloque.conflict!=undefined) {
            const fecha = Fecha.generarFechaHoraMySQL(new Date());
            salida.push(`<<<<< ORIGINAL "${fecha}" >>>>>`);
            salida.push(...bloque.conflict.o);
            salida.push(`<<<<< VERSION MODIFICADA "${fecha}" >>>>>`);
            salida.push(...bloque.conflict.a);
            salida.push(`<<<<< VERSION NUEVA "${fecha}" >>>>>`);
            salida.push(...bloque.conflict.b);
            salida.push(`<<<<< FIN "${fecha}" >>>>>`);
            if (filename!=undefined) {
                warning(` - Conflicto       ${Colors.colorize([Colors.FgRed, Colors.Bright], filename)}`);
            }
        }
    }

    return salida.join('\n');
}
