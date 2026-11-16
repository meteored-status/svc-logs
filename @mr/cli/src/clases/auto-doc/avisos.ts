/**
 * Editor: Juan C. Martínez
 * Fecha: Wed, 11 Nov 2026 10:30:11 GMT
 * Hash: 1c2d6a114d2a6d4efc13a35408f4a8fe
 * Versión: 2026.11.11+2-juancmartinez
 * Proyecto: git@github.com:alpred/meteored-svc-panel-usuarios.git
 */

import type ts from "typescript";

/**
 * Severidad de un aviso. Un `error` hace fallar la generación del servicio; un `aviso` solo se
 * imprime (y falla con `--strict`).
 */
export type TSeveridad = "error" | "aviso";

/**
 * Incidencia detectada al generar la documentación.
 *
 * @property severidad - Si es `error`, el servicio no se documenta.
 * @property mensaje   - Qué ha pasado.
 * @property ubicacion - `fichero:línea` del código que lo causa, relativo a la raíz del monorepo.
 */
export interface IAviso {
    severidad: TSeveridad;
    mensaje: string;
    ubicacion?: string;
}

/**
 * Ubicación `fichero:línea` de un nodo, con el fichero relativo a la raíz.
 *
 * @param node - Nodo del AST.
 * @param raiz - Raíz del monorepo.
 */
export function ubicacionDe(node: ts.Node, raiz: string): string {
    const fichero = node.getSourceFile();
    const {line} = fichero.getLineAndCharacterOfPosition(node.getStart(fichero));
    const prefijo = raiz.endsWith("/") ? raiz : `${raiz}/`;
    const nombre = fichero.fileName.startsWith(prefijo) ? fichero.fileName.slice(prefijo.length) : fichero.fileName;

    return `${nombre}:${line + 1}`;
}

/**
 * Texto de una incidencia para la consola.
 *
 * @param aviso - Incidencia a formatear.
 */
export function formatearAviso(aviso: IAviso): string {
    const donde = aviso.ubicacion === undefined ? "" : ` (${aviso.ubicacion})`;

    return `${aviso.severidad === "error" ? "ERROR" : "AVISO"}: ${aviso.mensaje}${donde}`;
}
