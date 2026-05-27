/**
 * Editor: José Antonio Jiménez
 * Fecha: Thu, 21 May 2026 06:51:30 GMT
 * Hash: 1ca0b54e6816f9f6a982a9878518b012
 * Versión: 2026.5.21+1-josantoniojimnez
 */

import type {Target as TTarget} from "@rspack/core";

import {Runtime} from "@mr/core-dev/manifest/deployment";

/**
 * Genera el valor de `target` de rspack según el runtime.
 *
 * | Runtime   | Target          | Descripción |
 * |-----------|-----------------|-------------|
 * | `node`    | `"node"`        | Módulos CommonJS / ESM para Node.js. |
 * | `browser` | `["web","es5"]` | Bundle compatible con navegadores ES5. |
 *
 * @param runtime - Runtime del bundle.
 * @returns Valor de `target` para la configuración de rspack.
 * @throws {Error} Si el runtime no está soportado.
 */
export function Target(runtime: Runtime): TTarget {
    switch (runtime) {
        case Runtime.node:
            return "node";
        case Runtime.browser:
            return ["web", "es5"];
        default:
            throw new Error(`Runtime no soportado: ${runtime}`);
    }
}
