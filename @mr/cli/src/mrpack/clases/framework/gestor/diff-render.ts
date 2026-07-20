/**
 * Editor: José Antonio Jiménez
 * Fecha: Tue, 14 Jul 2026 07:18:57 GMT
 * Hash: 09df0d8954dab7060d73d642d137e5b6
 * Versión: 2026.7.14+1-josantoniojimnez
 * Proyecto: https://github.com/meteored-status/svc-logs.git
 */

/**
 * Utilidades puras de cálculo y renderizado de diffs estructurados (side-by-side y unificado)
 * usadas por la vista de diff de {@link GestorTabla}. No dependen del estado de la tabla.
 */

import {calcularDiffOps, DIFF_CONTEXTO, indicesConContexto} from "../../../utiles/diff";
import {anchoVisible} from "../../../utiles/tty";
import {Colors} from "../../colors";
import {EstadoArchivo, type IArchivoCambiado} from "../../paquete";

/**
 * Operación elemental de un diff estructurado.
 *
 * @property tipo   - `" "` contexto, `"+"` añadido, `"-"` eliminado.
 * @property linea  - Contenido de la línea.
 * @property noA    - Número de línea en el lado A (base). Para `"+"` equivale al número de la última línea base vista (afterBase).
 * @property noB    - Número de línea en el lado B (destino). Para `"-"` es 0.
 */
export interface IDiffOp {
    tipo: " " | "+" | "-";
    linea: string;
    noA: number;
    noB: number;
}

/**
 * Crea los elementos de borde y la función de fila para un panel con borde doble magenta.
 */
export function panelMagenta(innerWidth: number): {
    top: string; mid: string; bot: string;
    fila: (rawText: string, colorFn?: (s: string) => string) => string;
    filaColoreada: (coloredLine: string) => string;
} {
    const BOR  = (s: string) => Colors.colorize([Colors.FgMagenta], s);
    const borH = "═".repeat(innerWidth);
    return {
        top: BOR(`╔${borH}╗`),
        mid: BOR(`╠${borH}╣`),
        bot: BOR(`╚${borH}╝`),
        fila: (rawText, colorFn = s => s) => {
            const nfc = rawText.normalize("NFC");
            const pad = nfc.padEnd(innerWidth - 2);
            return `${BOR("║")}  ${colorFn(pad)}${BOR("║")}`;
        },
        filaColoreada: (coloredLine) => {
            const visible = anchoVisible(coloredLine);
            const padding = " ".repeat(Math.max(0, innerWidth - 2 - visible));
            return `${BOR("║")} ${coloredLine}${padding} ${BOR("║")}`;
        },
    };
}

/**
 * Calcula las operaciones LCS entre dos arrays de líneas y devuelve la lista
 * estructurada de ops con números de línea correctos.
 * Para ops `"+"`: `noA` contiene la última línea base vista (afterBase).
 */
function lcsOps(aL: string[], bL: string[], offsetA: number, offsetB: number): IDiffOp[] {
    const raw = calcularDiffOps(aL, bL, 5000) ?? [];
    let noA = offsetA;
    let noB = offsetB;
    let lastNoA = offsetA;
    return raw.map(op => {
        if (op.tipo !== "add") { noA++; lastNoA = noA; }
        if (op.tipo !== "remove") { noB++; }
        const tipo = op.tipo === "equal" ? " " : op.tipo === "add" ? "+" : "-";
        return {tipo, linea: op.linea, noA: op.tipo === "add" ? lastNoA : noA, noB: op.tipo === "remove" ? 0 : noB};
    });
}

/**
 * Alinea dos arrays de ops (ambos generados desde la misma base) en filas side-by-side,
 * sincronizando por número de línea base (`noA`).
 */
function alinearOps(opsL: IDiffOp[], opsR: IDiffOp[]): Array<{left: IDiffOp|null; right: IDiffOp|null}> {
    const rows: Array<{left: IDiffOp|null; right: IDiffOp|null}> = [];
    let iL = 0, iR = 0;
    while (iL < opsL.length || iR < opsR.length) {
        const opL = iL < opsL.length ? opsL[iL] : null;
        const opR = iR < opsR.length ? opsR[iR] : null;
        if (!opL) { rows.push({left: null, right: opR!}); iR++; continue; }
        if (!opR) { rows.push({left: opL, right: null}); iL++; continue; }
        const insL = opL.tipo === "+", insR = opR.tipo === "+";
        if (insL && insR) {
            if (opL.noA === opR.noA) {
                rows.push({left: opL, right: opR}); iL++; iR++;
            } else if (opL.noA < opR.noA) {
                rows.push({left: opL, right: null}); iL++;
            } else {
                rows.push({left: null, right: opR}); iR++;
            }
        } else if (insL) {
            if (opL.noA < opR.noA) { rows.push({left: opL, right: null}); iL++; }
            else { rows.push({left: null, right: opR}); iR++; }
        } else if (insR) {
            if (opR.noA < opL.noA) { rows.push({left: null, right: opR}); iR++; }
            else { rows.push({left: opL, right: null}); iL++; }
        } else {
            if (opL.noA === opR.noA) { rows.push({left: opL, right: opR}); iL++; iR++; }
            else if (opL.noA < opR.noA) { rows.push({left: opL, right: null}); iL++; }
            else { rows.push({left: null, right: opR}); iR++; }
        }
    }
    return rows;
}

/**
 * Renderiza una celda de columna para el diff side-by-side.
 * La longitud visible de la cadena devuelta es siempre exactamente `colWidth`.
 */
function renderCeldaDiff(op: IDiffOp | null, colWidth: number): string {
    if (op === null || colWidth < 12) {
        return " ".repeat(Math.max(0, colWidth));
    }
    const numA   = op.tipo !== "+" ? String(op.noA).padStart(4) : "    ";
    const numB   = op.tipo !== "-" ? String(op.noB).padStart(4) : "    ";
    const nums   = Colors.colorize([Colors.Dim], `${numA} ${numB}`);
    const maxC   = colWidth - 12;
    const raw    = op.linea.replace(/\t/g, "    ");
    const txt    = raw.length > maxC ? raw.slice(0, maxC - 1) + "…" : raw.padEnd(maxC);
    if (op.tipo === "+") {
        return `${nums} ${Colors.colorize([Colors.FgGreen], `+ ${txt}`)}`;
    } else if (op.tipo === "-") {
        return `${nums} ${Colors.colorize([Colors.FgRed],   `- ${txt}`)}`;
    } else {
        return `${nums} ${Colors.colorize([Colors.Dim],     `  ${txt}`)}`;
    }
}

/**
 * Genera un diff "side by side" alineado por línea base.
 * Columna izquierda: `base → local`; columna derecha: `base → remoto`.
 * Cada línea devuelta tiene longitud visible `2 * colWidth + 3` (+ separador central ` │ `).
 */
export function calcularDiffSideBySide(base: string, local: string, remoto: string, {offsetBase = 0, offsetLocal = 0, offsetRemoto = 0, colWidth}: {offsetBase?: number; offsetLocal?: number; offsetRemoto?: number; colWidth: number}): string[] {
    const MAX = 5000;
    const baseL   = base.split("\n");
    const localL  = local.split("\n");
    const remotoL = remoto.split("\n");
    if (baseL.length > MAX || localL.length > MAX || remotoL.length > MAX) {
        return [Colors.colorize([Colors.FgYellow], "  ⚠  Fichero demasiado largo para diff en línea")];
    }
    const opsL = lcsOps(baseL, localL,  offsetBase, offsetLocal);
    const opsR = lcsOps(baseL, remotoL, offsetBase, offsetRemoto);
    const rows = alinearOps(opsL, opsR);
    const CONTEXTO = 3;
    const mostrar = new Set<number>();
    for (let k = 0; k < rows.length; k++) {
        const {left, right} = rows[k];
        if ((left !== null && left.tipo !== " ") || (right !== null && right.tipo !== " ")) {
            for (let c = Math.max(0, k - CONTEXTO); c <= Math.min(rows.length - 1, k + CONTEXTO); c++) {
                mostrar.add(c);
            }
        }
    }
    const sepCol = Colors.colorize([Colors.Dim], " │ ");
    const lineas: string[] = [];
    if (offsetBase > 0 || offsetLocal > 0 || offsetRemoto > 0) {
        lineas.push(Colors.colorize([Colors.FgCyan, Colors.Dim], "  @@ ··· registro de autoría ···"));
    }
    if (mostrar.size === 0) {
        const txt = "(ficheros idénticos)".padEnd(colWidth);
        lineas.push(`${Colors.colorize([Colors.FgYellow], txt)}${sepCol}${Colors.colorize([Colors.FgYellow], txt)}`);
        return lineas;
    }
    // Cabecera de columnas
    const hL = Colors.colorize([Colors.FgYellow, Colors.Dim], " enviar".slice(0, colWidth).padEnd(colWidth));
    const hR = Colors.colorize([Colors.FgYellow, Colors.Dim], " actualizar".slice(0, colWidth).padEnd(colWidth));
    lineas.push(`${hL}${sepCol}${hR}`);
    let ultimoMostrado = -1;
    for (let k = 0; k < rows.length; k++) {
        if (!mostrar.has(k)) { continue; }
        if (ultimoMostrado !== -1 && k > ultimoMostrado + 1) {
            const saltados = k - ultimoMostrado - 1;
            lineas.push(Colors.colorize([Colors.FgCyan, Colors.Dim], `  @@ ··· ${saltados} línea(s) sin cambios ···`));
        }
        const {left, right} = rows[k];
        lineas.push(`${renderCeldaDiff(left, colWidth)}${sepCol}${renderCeldaDiff(right, colWidth)}`);
        ultimoMostrado = k;
    }
    return lineas;
}

/**
 * Calcula el diff entre dos cadenas de texto línea a línea usando LCS.
 * Devuelve las líneas ya coloreadas (número de línea + prefijo +/-/espacio + contenido).
 * Los parámetros `offsetA` y `offsetB` permiten que los números de línea reflejen
 * la posición real en el fichero original (p.ej. tras eliminar el bloque de autoría).
 * `maxLineWidth` limita la longitud visible total de cada línea (el contenido se trunca con `…`).
 */
export function calcularDiff(original: string, nuevo: string, {offsetA = 0, offsetB = 0, maxLineWidth}: {offsetA?: number; offsetB?: number; maxLineWidth?: number} = {}): string[] {
    const aL = original.split("\n");
    const bL = nuevo.split("\n");

    const rawOps = calcularDiffOps(aL, bL, 5000);
    if (rawOps === null) {
        return [Colors.colorize([Colors.FgYellow], "  ⚠  Fichero demasiado largo para diff en línea")];
    }

    const mostrar = indicesConContexto(rawOps, DIFF_CONTEXTO);

    if (mostrar.size === 0) {
        return [Colors.colorize([Colors.FgYellow], "  (ficheros idénticos)")];
    }

    // Cabecera visible = 12 chars (4+1+4+1+tipo+espacio); el resto es contenido.
    const HEADER_W = 12;
    const maxC = maxLineWidth !== undefined ? Math.max(1, maxLineWidth - HEADER_W) : undefined;

    const lineas: string[] = [];
    let noA = offsetA;
    let noB = offsetB;
    let ultimoMostrado = -1;

    if (offsetA > 0 || offsetB > 0) {
        lineas.push(Colors.colorize([Colors.FgCyan, Colors.Dim], "  @@ ··· registro de autoría ···"));
    }

    for (let k = 0; k < rawOps.length; k++) {
        const op = rawOps[k];
        if (op.tipo !== "add") { noA++; }
        if (op.tipo !== "remove") { noB++; }
        if (!mostrar.has(k)) { continue; }

        if (ultimoMostrado !== -1 && k > ultimoMostrado + 1) {
            const saltados = k - ultimoMostrado - 1;
            lineas.push(Colors.colorize([Colors.FgCyan, Colors.Dim], `  @@ ··· ${saltados} línea(s) sin cambios ···`));
        }

        const numA       = op.tipo !== "add"    ? String(noA).padStart(4) : "    ";
        const numB       = op.tipo !== "remove"  ? String(noB).padStart(4) : "    ";
        const num        = Colors.colorize([Colors.Dim], `${numA} ${numB}`);
        const rawContent = op.linea.replace(/\t/g, "    ");
        const contenido  = maxC !== undefined && rawContent.length > maxC
            ? rawContent.slice(0, maxC - 1) + "…"
            : rawContent;

        if (op.tipo === "add") {
            lineas.push(`${num} ${Colors.colorize([Colors.FgGreen], `+ ${contenido}`)}`);
        } else if (op.tipo === "remove") {
            lineas.push(`${num} ${Colors.colorize([Colors.FgRed], `- ${contenido}`)}`);
        } else {
            lineas.push(`${num}   ${Colors.colorize([Colors.Dim], contenido)}`);
        }

        ultimoMostrado = k;
    }

    return lineas;
}

/**
 * `true` si el fichero puede abrirse en el visor de diff.
 * Solo los ficheros con estado `"cambiado"`, sin conflicto y fuera de `bin/min/` son diffables.
 */
export function esDiffable(item: IArchivoCambiado): boolean {
    return item.estado === EstadoArchivo.Cambiado && !item.conflicto && !item.archivo.startsWith("bin/min");
}
