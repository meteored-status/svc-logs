/**
 * Editor: José Antonio Jiménez
 * Fecha: Wed, 27 May 2026 09:00:52 GMT
 * Hash: 65f0ce475cc185ca55e07157c626879c
 * Versión: 2026.5.27+1-josantoniojimnez
 */

import path from "node:path";

import {mkdir, readDir, safeWrite} from "services-comun/modules/utiles/fs";

import type {IPaqueteGestion} from "./datos";

/**
 * Escribe el log de una actualización en `{basedir}/tmp/log/{nombre}.pull.md`.
 * Si el fichero ya existe se sobreescribe completamente.
 *
 * @param basedir  - Raíz absoluta del monorepo.
 * @param info     - Información del paquete actualizado.
 * @param entradas - Listado de ficheros afectados con su estado.
 * @param logsRaw  - Salida de consola capturada durante la actualización.
 * @returns Ruta absoluta del fichero de log escrito.
 */
export async function escribirLog(basedir: string, info: IPaqueteGestion, entradas: {archivo: string; estado: "ok" | "error"}[], logsRaw: string[]): Promise<string> {
    const logDir = `${basedir}/tmp/log`;
    await mkdir(logDir, true);

    const safeNombre = info.npmName.replace(/[@/]/g, "-").replace(/^-+/, "");
    const logPath    = `${logDir}/${safeNombre}.pull.md`;

    const fecha     = new Date().toISOString().replace("T", " ").replace(/\.\d+Z$/, " UTC");
    const versionDe = info.versionLocal ?? "no instalado";
    const versionA  = info.versionLatest ?? "desconocido";

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

    for (const entrada of entradas) {
        const estado = entrada.estado === "ok" ? "OK" : "Error";
        const absPath = path.resolve(info.localDir, entrada.archivo);
        const relPath = path.relative(logDir, absPath).replace(/\\/g, "/");
        const archivo = entrada.archivo.replace(/\|/g, "\\|");
        lineas.push(`| ${estado} | [\`${archivo}\`](${relPath}) |`);
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

    const lineas: string[] = [
        `# Push ${info.npmName}`,
        "",
        `- Fecha: ${fecha}`,
        `- Versión publicada: ${version}`,
        "",
        "## Archivos enviados",
        "",
        ...archivos.map((archivo) => {
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

