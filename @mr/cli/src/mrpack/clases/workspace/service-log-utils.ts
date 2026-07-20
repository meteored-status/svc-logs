/**
 * Editor: José Antonio Jiménez
 * Fecha: Tue, 14 Jul 2026 07:18:57 GMT
 * Hash: 7ea5fb27640cd8961cc316b79f63d7d4
 * Versión: 2026.7.14+1-josantoniojimnez
 * Proyecto: https://github.com/meteored-status/svc-logs.git
 */

/**
 * Utilidades puras de formateo y parsing usadas por `Service` para generar el log
 * markdown de compilación (`output/compilar.md`): timestamps legibles y detección
 * de referencias a fichero:línea:columna en la salida de los bundlers.
 */

import path from "node:path";

import {fechaHoraLocal, horaLocal} from "../../utiles/fecha";

export {fechaHoraLocal, horaLocal};

/**
 * Referencia a un fichero fuente detectada en la salida de un bundler (rspack/esbuild/next),
 * con la posición de línea/columna si estaba disponible.
 *
 * @property label  - Texto a mostrar (p.ej. `archivo.ts:12:5`).
 * @property href   - Ruta relativa al fichero (relativa a `{workspace}/output`).
 * @property lineNum - Número de línea detectado (`0` si no había).
 * @property colNum  - Número de columna detectado (`0` si no había).
 */
export interface IFileRef {
    label: string;
    href: string;
    lineNum: number;
    colNum: number;
}

/**
 * Detecta referencias a ficheros fuente (`archivo.ts:línea:columna`) en las líneas de
 * salida de un bundler, deduplicándolas y ordenándolas por nombre de fichero/línea/columna.
 * Las rutas se resuelven asumiendo que rspack corre desde `{root}/@mr/core/dev`
 * (`yarn workspace @mr/core-dev`), y se devuelven relativas a `{dir}/output`.
 *
 * @param lineas - Líneas de salida del bundler (pueden contener códigos ANSI y prefijo `[ERR] `).
 * @param root   - Raíz absoluta del monorepo.
 * @param dir    - Directorio absoluto del workspace.
 * @returns Referencias a fichero detectadas, deduplicadas y ordenadas.
 */
export function extractFileRefs(lineas: string[], root: string, dir: string): IFileRef[] {
    const patron = /([^\s'"<>()|,]+\.(?:tsx|ts|jsx|js|mjs|cjs|scss|css|html))(?::(\d+)(?::(\d+))?)?/g;
    const refs: Map<string, {label: string; href: string; baseName: string; lineNum: number; colNum: number}> = new Map();
    for (const linea of lineas) {
        const text = linea.replace(/\x1B\[[0-9;]*[mGKF]/g, "").replace(/^\[ERR] /, "");
        patron.lastIndex = 0;
        let match = patron.exec(text);
        while (match !== null) {
            const actual = match;
            match = patron.exec(text);

            const rawPath = actual[1];
            if (rawPath.includes("node_modules")) {
                continue;
            }
            const lineNum = actual[2] !== undefined ? parseInt(actual[2], 10) : 0;
            const colNum = actual[3] !== undefined ? parseInt(actual[3], 10) : 0;
            // rspack corre desde {root}/@mr/core/dev (yarn workspace @mr/core-dev)
            // → las rutas relativas del output son relativas a ese directorio
            const rspackCwd = path.join(root, "@mr", "core", "dev");
            const absPath = path.resolve(rspackCwd, rawPath);
            const relPath = path.relative(path.join(dir, "output"), absPath);
            const key = `${relPath}:${lineNum}:${colNum}`;
            if (!refs.has(key)) {
                const baseName = path.basename(rawPath);
                const label = lineNum > 0
                    ? colNum > 0
                        ? `${baseName}:${lineNum}:${colNum}`
                        : `${baseName}:${lineNum}`
                    : baseName;
                refs.set(key, {label, href: relPath, baseName, lineNum, colNum});
            }
        }
    }
    return [...refs.values()]
        .sort((a, b) =>
            a.baseName.localeCompare(b.baseName) ||
            a.lineNum - b.lineNum ||
            a.colNum - b.colNum
        )
        .map(({label, href, lineNum, colNum}) => ({label, href, lineNum, colNum}));
}
