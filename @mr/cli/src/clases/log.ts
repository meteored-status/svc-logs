/**
 * Editor: alexCG
 * Fecha: Tue, 20 Oct 2026 07:44:09 GMT
 * Hash: 86a65bd5cb805ab5f94a1d0085cc7424
 * Versión: 2026.10.20+1-alexcg
 * Anterior: 2026.9.23+2-bixus
 * Proyecto: https://github.com/alpred/meteored-svc-amateur.git
 */

import util from "node:util";

import {Colors} from "@mr/core-cli/colors";

import {horaLocal} from "../utiles/fecha";

interface ILogConfig {
    type: string;
    label: string;
}

// Pila de etiquetas activas (una por cada `Log.group()` sin su `Log.groupEnd()` correspondiente).
// Representa el anidamiento lógico (p.ej. "init" → "cliente" → "framework") directamente en la
// etiqueta compuesta de cada línea, en vez de depender de la indentación de console.group/groupEnd.
const pilaEtiquetas: string[] = [];

/**
 * Compone la etiqueta final combinando la pila de grupos activos con la etiqueta propia,
 * evitando duplicarla si coincide con la del grupo más interno (p.ej. llamadas repetidas
 * dentro de la misma función con la misma etiqueta que el grupo que acaban de abrir).
 *
 * @param label - Etiqueta propia de la llamada actual.
 * @returns Etiqueta compuesta, p.ej. `"init cliente"`.
 */
function etiquetaCompuesta(label: string): string {
    if (pilaEtiquetas.length>0 && pilaEtiquetas[pilaEtiquetas.length-1]===label) {
        return pilaEtiquetas.join(" ");
    }
    return [...pilaEtiquetas, label].join(" ");
}

function corchete(txt: string): string {
    return Colors.colorize([Colors.FgMagenta], txt);
}

function generarFechaLog(cfg: ILogConfig): string {
    return `${corchete("[")}${horaLocal(new Date())}${corchete("]")}${corchete("[")}${cfg.type}${corchete("]")}${corchete("[")}${etiquetaCompuesta(cfg.label)}${corchete("]")}`;
}

export const Log = {
    label_base:     `${Colors.colorize([Colors.FgYellow, Colors.Underscore], "ENTORNO")} ` as string,
    label_compilar: `${Colors.colorize([Colors.FgGreen, Colors.Underscore],  "GENERAR")} ` as string,
    label_ejecutar: `${Colors.colorize([Colors.FgCyan, Colors.Underscore],   "EJECUTAR")}` as string,
    label_pubsub:   `${Colors.colorize([Colors.FgBlue, Colors.Underscore],   "PUBSUB")}  ` as string,

    // Escribimos directamente a stdout/stderr (en vez de console.info/console.error) para
    // evitar que console.group()/groupEnd() indente nuestras líneas: el prefijo [hora][tipo][label]
    // ya aporta contexto suficiente y la indentación adicional lo duplicaba de forma confusa.
    info(cfg: ILogConfig, ...txt: any[]): void {
        if (txt.length>0) {
            process.stdout.write(`${util.format(generarFechaLog(cfg), ...txt)}\n`);
        }
    },

    error(cfg: ILogConfig, ...txt: any[]): void {
        if (txt.length>0) {
            process.stderr.write(`${util.format(generarFechaLog(cfg), ...txt)}\n`);
        }
    },

    /**
     * Loguea `txt` igual que {@link Log.info} y abre un grupo con `cfg.label`: todas las
     * llamadas a `Log.info`/`Log.error` hasta el `Log.groupEnd()` correspondiente mostrarán
     * la etiqueta anidada (p.ej. `"init cliente"`) en vez de solo la propia.
     *
     * @param cfg - Tipo y etiqueta del grupo a abrir.
     * @param txt - Mensaje a loguear (igual que {@link Log.info}).
     */
    group(cfg: ILogConfig, ...txt: any[]): void {
        Log.info(cfg, ...txt);
        pilaEtiquetas.push(cfg.label);
    },

    /**
     * Cierra el grupo más reciente abierto con {@link Log.group}.
     */
    groupEnd(): void {
        pilaEtiquetas.pop();
    },
};
