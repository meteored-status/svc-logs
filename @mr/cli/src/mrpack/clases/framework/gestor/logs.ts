/**
 * Editor: José Antonio Jiménez
 * Fecha: Fri, 03 Jul 2026 07:46:10 GMT
 * Hash: e8ac6bd98ab88060122e3a34cd55ce8f
 * Versión: 2026.7.3+2-josantoniojimnez
 * Anterior: 2026.7.2+2-josantoniojimnez
 * Proyecto: https://github.com/meteored-status/svc-logs.git
 */

import path from "node:path";

import {mkdir, readDir, safeWrite} from "services-comun/modules/utiles/fs";

import type {IEntradaActualizacion} from "../../paquete/file";
import type {IPaqueteGestion} from "./datos";

/** Prefijo de rutas de artefactos binarios que se excluyen de los logs (igual que en el TUI). */
const PREFIJO_BINARIO = "bin/min";

/**
 * Genera un identificador de anclaje Markdown estable a partir de la ruta de un archivo.
 *
 * @param archivo - Ruta relativa del archivo.
 * @returns Identificador válido para usar como ancla `#conflicto-...`.
 */
function anclaConflicto(archivo: string): string {
    return `conflicto-${archivo.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")}`;
}

/**
 * Escribe el log de una actualización en `{basedir}/tmp/log/{nombre}.pull.md`.
 * Si el fichero ya existe se sobreescribe completamente.
 *
 * @param basedir  - Raíz absoluta del monorepo.
 * @param info     - Información del paquete actualizado.
 * @param entradas - Listado de ficheros afectados con su estado.
 * @param logsRaw  - Salida de consola capturada durante la actualización.
 * @param error    - Mensaje/stack del error que interrumpió la actualización, si lo hubo.
 * @returns Ruta absoluta del fichero de log escrito.
 */
export async function escribirLog(basedir: string, info: IPaqueteGestion, entradas: IEntradaActualizacion[], logsRaw: string[], error?: string): Promise<string> {
    const logDir = `${basedir}/tmp/log`;
    await mkdir(logDir, true);

    const safeNombre = info.npmName.replace(/[@/]/g, "-").replace(/^-+/, "");
    const logPath    = `${logDir}/${safeNombre}.pull.md`;

    const fecha     = new Date().toISOString().replace("T", " ").replace(/\.\d+Z$/, " UTC");
    const versionDe = info.versionLocal ?? "no instalado";
    const versionA  = info.versionLatest ?? "desconocido";

    const entradasFiltradas = entradas.filter(e => !e.archivo.startsWith(PREFIJO_BINARIO));
    const entradasConConflicto = entradasFiltradas.filter(e => e.conflictos !== undefined && e.conflictos.length > 0);

    const lineas: string[] = [
        `# Update ${info.npmName}`,
        "",
        `- Fecha: ${fecha}`,
        `- Versión local: ${versionDe}`,
        `- Versión remota: ${versionA}`,
        "",
        "## Archivos",
        "",
        "| Estado | Archivo |",
        "|---|---|",
    ];

    for (const entrada of entradasFiltradas) {
        const archivo = entrada.archivo.replace(/\|/g, "\\|");
        const estado = entrada.conflictos !== undefined && entrada.conflictos.length > 0
            ? `[Conflicto](#${anclaConflicto(entrada.archivo)})`
            : (entrada.estado === "ok" ? "OK" : "Error");
        const absPath = path.resolve(info.localDir, entrada.archivo);
        const relPath = path.relative(logDir, absPath).replace(/\\/g, "/");
        lineas.push(`| ${estado} | [\`${archivo}\`](${relPath}) |`);
    }

    if (error) {
        lineas.push("");
        lineas.push("## Error");
        lineas.push("");
        lineas.push("```text");
        lineas.push(error);
        lineas.push("```");
    }

    if (entradasConConflicto.length > 0) {
        lineas.push("");
        lineas.push("## Conflictos");

        for (const entrada of entradasConConflicto) {
            const archivo = entrada.archivo.replace(/\|/g, "\\|");
            lineas.push("");
            lineas.push(`### \`${archivo}\` {#${anclaConflicto(entrada.archivo)}}`);

            entrada.conflictos!.forEach((bloque, indice) => {
                lineas.push("");
                lineas.push(`**Sección ${indice + 1}**`);
                lineas.push("");
                lineas.push("```text");
                lineas.push("<<<<<<< LOCAL");
                lineas.push(...bloque.local);
                lineas.push("||||||| BASE");
                lineas.push(...bloque.base);
                lineas.push("=======");
                lineas.push(...bloque.remote);
                lineas.push(">>>>>>> REMOTE");
                lineas.push("```");
            });
        }
    }

    if (logsRaw.length > 0) {
        lineas.push("");
        lineas.push("## Salida del proceso");
        lineas.push("");
        lineas.push("```text");
        lineas.push(...logsRaw);
        lineas.push("```");
    }

    await safeWrite(logPath, `${lineas.join("\n")}\n`, true);
    await actualizarIndiceLogs(logDir);
    return logPath;
}

/**
 * Escribe el log de un envío en `{basedir}/tmp/log/{nombre}.push.md`.
 * Lista los ficheros que cambiaron respecto a la versión publicada anterior.
 *
 * @param basedir  - Raíz absoluta del monorepo.
 * @param info     - Información del paquete enviado.
 * @param archivos - Rutas relativas de los ficheros cambiados.
 * @returns Ruta absoluta del fichero de log escrito.
 */
export async function escribirLogPush(basedir: string, info: IPaqueteGestion, archivos: string[]): Promise<string> {
    const logDir = `${basedir}/tmp/log`;
    await mkdir(logDir, true);

    const safeNombre = info.npmName.replace(/[@/]/g, "-").replace(/^-+/, "");
    const logPath    = `${logDir}/${safeNombre}.push.md`;
    const fecha      = new Date().toISOString().replace("T", " ").replace(/\.\d+Z$/, " UTC");
    const version    = info.paquete.versionPublica;

    const archivosFiltrados = archivos.filter(a => !a.startsWith(PREFIJO_BINARIO));

    const lineas: string[] = [
        `# Push ${info.npmName}`,
        "",
        `- Fecha: ${fecha}`,
        `- Versión publicada: ${version}`,
        "",
        "## Archivos enviados",
        "",
        ...archivosFiltrados.map((archivo) => {
            const absPath = path.resolve(info.localDir, archivo);
            const relPath = path.relative(logDir, absPath).replace(/\\/g, "/");
            return `- [\`${archivo}\`](${relPath})`;
        }),
    ];

    await safeWrite(logPath, `${lineas.join("\n")}\n`, true);
    await actualizarIndiceLogs(logDir);
    return logPath;
}

/**
 * Regenera `tmp/log/index.md` con enlaces a todos los logs existentes.
 *
 * @param logDir - Ruta absoluta del directorio de logs (`{basedir}/tmp/log`).
 */
export async function actualizarIndiceLogs(logDir: string): Promise<void> {
    const nombres = (await readDir(logDir))
        .filter(nombre => nombre.endsWith(".md") && nombre !== "index.md")
        .sort((a, b) => a.localeCompare(b));

    const updates = nombres.filter(nombre => nombre.endsWith(".pull.md"));
    const pushes  = nombres.filter(nombre => nombre.endsWith(".push.md"));

    const lineas: string[] = [
        "# Logs de mrpack",
        "",
        `- Actualizado: ${new Date().toISOString().replace("T", " ").replace(/\.\d+Z$/, " UTC")}`,
        "",
        "## Updates",
        "",
    ];

    if (updates.length === 0) {
        lineas.push("- _Sin logs de actualización_");
    } else {
        lineas.push(...updates.map(nombre => `- [\`${nombre}\`](./${nombre})`));
    }

    lineas.push("");
    lineas.push("## Pushes");
    lineas.push("");

    if (pushes.length === 0) {
        lineas.push("- _Sin logs de envío_");
    } else {
        lineas.push(...pushes.map(nombre => `- [\`${nombre}\`](./${nombre})`));
    }

    lineas.push("");
    await safeWrite(`${logDir}/index.md`, `${lineas.join("\n")}`, true);
}

