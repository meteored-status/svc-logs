/**
 * Editor: José Antonio Jiménez
 * Fecha: Fri, 15 May 2026 12:09:04 GMT
 * Hash: 03f69bceaef512f89c4a3c4c753dd348
 */

import {Fecha} from "services-comun/modules/utiles/fecha";

import {Colors} from "./colors";

interface ILogConfig {
    type: string;
    label: string;
}

function generarFechaLog(cfg: ILogConfig): string {
    return `[${Fecha.generarHora(new Date(), false)}][${cfg.type}][${cfg.label}]`;
}

export const Log = {
    label_base:     `${Colors.colorize([Colors.FgYellow, Colors.Underscore], "ENTORNO")} ` as string,
    label_compilar: `${Colors.colorize([Colors.FgGreen, Colors.Underscore],  "GENERAR")} ` as string,
    label_ejecutar: `${Colors.colorize([Colors.FgCyan, Colors.Underscore],   "EJECUTAR")}` as string,

    info(cfg: ILogConfig, ...txt: any[]): void {
        if (txt.length>0) {
            console.info(generarFechaLog(cfg), ...txt);
        }
    },

    error(cfg: ILogConfig, ...txt: any[]): void {
        if (txt.length>0) {
            console.error(generarFechaLog(cfg), ...txt);
        }
    },
};
