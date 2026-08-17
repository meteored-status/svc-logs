/**
 * Editor: José Antonio Jiménez
 * Fecha: Wed, 05 Aug 2026 06:48:03 GMT
 * Hash: 9a36177c64a6d5df8f9c7295dac4f7ef
 * Versión: 2026.8.5+2-josantoniojimnez
 * Proyecto: https://github.com/alpred/meteored-svc-estaticos
 */

import path from "node:path";

const BASE = path.resolve("assets");

/**
 * Resuelve `partes` como ruta relativa dentro del directorio `assets/` (relativo al `cwd` del
 * proceso) y comprueba que el resultado no se escape de él. Uso obligatorio en cualquier handler
 * que construya una ruta de fichero local a partir de datos de la URL (segmentos `regex`/`prefix`),
 * para evitar un path traversal (p.ej. `../../etc/passwd`) hacia ficheros fuera de `assets/`.
 *
 * @param partes - Segmentos de ruta relativos a `assets/` (pueden incluir `/`).
 * @returns Ruta resuelta dentro de `assets/`, o `null` si el resultado se saldría de ese directorio.
 */
export function resolveAsset(...partes: string[]): string|null {
    const resuelto = path.resolve(BASE, ...partes);
    if (resuelto!==BASE && !resuelto.startsWith(BASE+path.sep)) {
        return null;
    }
    return resuelto;
}
