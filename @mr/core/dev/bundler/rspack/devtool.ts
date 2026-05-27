/**
 * Editor: José Antonio Jiménez
 * Fecha: Thu, 21 May 2026 06:51:30 GMT
 * Hash: b8e23629c5e7731ab9962d943e07084a
 * Versión: 2026.5.21+1-josantoniojimnez
 */

import type {DevTool as TSourceMap} from "@rspack/core";

import {Runtime} from "@mr/core-dev/manifest/deployment";

/**
 * Genera la configuración de `devtool` (source maps) de rspack según el runtime y el entorno.
 *
 * - **Node:** siempre `"source-map"` para facilitar la depuración en producción.
 * - **Browser:** `"source-map"` únicamente si el entorno activo está en la lista `entornos`;
 *   `false` en caso contrario para no exponer el código fuente en producción.
 * - **Resto de runtimes:** `false`.
 *
 * @param runtime  - Runtime del bundle (`node`, `browser`, …).
 * @param entornos - Lista de entornos en los que se generan source maps para browser.
 * @param entorno  - Nombre del entorno activo (`"desarrollo"`, `"test"`, `"produccion"`…).
 * @returns Valor de `devtool` para la configuración de rspack.
 */
export function Devtool(runtime: Runtime, entornos: string[], entorno: string): TSourceMap {
    switch (runtime) {
        case Runtime.node:
            return "source-map";
        case Runtime.browser:
            return entornos.includes(entorno) ? "source-map" : false;
        default:
            return false;
    }
}
