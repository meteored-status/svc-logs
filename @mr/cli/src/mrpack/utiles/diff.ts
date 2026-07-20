/**
 * Editor: José Antonio Jiménez
 * Fecha: Fri, 26 Jun 2026 10:04:43 GMT
 * Hash: 689d0ca11434f3dac885e3a8931750b8
 * Versión: 2026.6.26+1-josantoniojimnez
 * Proyecto: https://github.com/alpred/meteored-web-www.git
 */

/**
 * Utilidades de diff LCS compartidas entre el visor TUI (`GestorTabla`)
 * y el generador de logs HTML (`push-log`).
 *
 * La función {@link calcularDiffOps} calcula las operaciones en bruto (equal/add/remove).
 * Cada consumidor aplica su propio estilizado (ANSI para el terminal, HTML para logs).
 */

/**
 * Operación elemental de diff sin estilizar.
 *
 * @property tipo  - `"equal"` sin cambio, `"add"` añadida, `"remove"` eliminada.
 * @property linea - Contenido de la línea.
 */
export interface IDiffRawOp {
    tipo: "equal" | "add" | "remove";
    linea: string;
}

/** Número de líneas de contexto a mostrar alrededor de cada cambio. */
export const DIFF_CONTEXTO = 3;

/**
 * Calcula las operaciones LCS entre dos arrays de líneas.
 * Devuelve `null` si alguno supera `maxLineas` (fichero demasiado grande).
 *
 * @param aLines   - Líneas del texto base (original).
 * @param bLines   - Líneas del texto destino (nuevo).
 * @param maxLineas - Máximo de líneas por lado. Si se supera, devuelve `null`.
 */
export function calcularDiffOps(aLines: string[], bLines: string[], maxLineas: number): IDiffRawOp[] | null {
    if (aLines.length > maxLineas || bLines.length > maxLineas) {
        return null;
    }

    const m = aLines.length;
    const n = bLines.length;
    const dp: number[][] = Array.from({length: m + 1}, () => new Array(n + 1).fill(0) as number[]);

    for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
            dp[i][j] = aLines[i - 1] === bLines[j - 1]
                ? dp[i - 1][j - 1] + 1
                : Math.max(dp[i - 1][j], dp[i][j - 1]);
        }
    }

    const ops: IDiffRawOp[] = [];
    let i = m;
    let j = n;
    while (i > 0 || j > 0) {
        if (i > 0 && j > 0 && aLines[i - 1] === bLines[j - 1]) {
            ops.push({tipo: "equal", linea: aLines[i - 1]});
            i--;
            j--;
        } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
            ops.push({tipo: "add", linea: bLines[j - 1]});
            j--;
        } else {
            ops.push({tipo: "remove", linea: aLines[i - 1]});
            i--;
        }
    }

    ops.reverse();
    return ops;
}

/**
 * Devuelve el conjunto de índices de operaciones que deben mostrarse:
 * las líneas modificadas más las líneas de contexto alrededor de cada cambio.
 *
 * @param ops     - Lista de operaciones devuelta por {@link calcularDiffOps}.
 * @param contexto - Número de líneas de contexto a cada lado. Por defecto {@link DIFF_CONTEXTO}.
 * @returns Conjunto de índices de `ops` a incluir en la salida.
 */
export function indicesConContexto(ops: IDiffRawOp[], contexto = DIFF_CONTEXTO): Set<number> {
    const mostrar = new Set<number>();
    for (let k = 0; k < ops.length; k++) {
        if (ops[k].tipo !== "equal") {
            const desde = Math.max(0, k - contexto);
            const hasta = Math.min(ops.length - 1, k + contexto);
            for (let c = desde; c <= hasta; c++) {
                mostrar.add(c);
            }
        }
    }
    return mostrar;
}

