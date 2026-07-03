/**
 * Editor: José Antonio Jiménez
 * Fecha: Thu, 25 Jun 2026 06:52:42 GMT
 * Hash: 9921b58dc3277077971943b30839c12d
 * Versión: 2026.6.25+5-josantoniojimnez
 * Anterior: 2026.6.25+4-josantoniojimnez
 */

import {Colors} from "./colors";

interface ILogConfig {
    type: string;
    label: string;
}

function horaLocal(d: Date): string {
    return [d.getHours(), d.getMinutes(), d.getSeconds()]
        .map(n => String(n).padStart(2, "0"))
        .join(":");
}

function generarFechaLog(cfg: ILogConfig): string {
    return `[${horaLocal(new Date())}][${cfg.type}][${cfg.label}]`;
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
