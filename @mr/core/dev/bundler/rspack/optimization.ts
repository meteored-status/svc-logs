/**
 * Editor: José Antonio Jiménez
 * Fecha: Thu, 21 May 2026 06:51:30 GMT
 * Hash: 5732905a14401617edf19fe4b32ff8da
 * Versión: 2026.5.21+1-josantoniojimnez
 */

import {type Optimization as TOptimization} from "@rspack/core";

import {Runtime} from "@mr/core-dev/manifest/deployment";

/**
 * Optimización para bundles Node.
 * No se usa `concatenateModules` porque los módulos se cargan en tiempo de ejecución
 * (no hay beneficio de tamaño al ser externos).
 */
function buildNode(desarrollo: boolean): TOptimization {
    return {
        concatenateModules: false,
        minimize: !desarrollo,
    };
}

/**
 * Optimización para bundles browser.
 * Activa `splitChunks` con un `vendor` chunk para separar `node_modules` del código
 * de la aplicación y aprovechar el caché del navegador entre despliegues.
 */
function buildBrowser(desarrollo: boolean): TOptimization {
    return {
        concatenateModules: true,
        minimize: !desarrollo,
        runtimeChunk: false,
        splitChunks: {
            cacheGroups: {
                vendor: {
                    test: /[\\/]node_modules[\\/]/,
                    name: "vendor",
                    chunks: "all",
                },
            },
            chunks: "all",
        },
    };
}

/**
 * Genera la sección `optimization` de la configuración de rspack.
 *
 * | Runtime   | `concatenateModules` | `minimize` | `splitChunks` |
 * |-----------|:--------------------:|:----------:|:-------------:|
 * | `node`    | `false`              | producción | —             |
 * | `browser` | `true`               | producción | vendor chunk  |
 *
 * La minificación usa el minificador built-in de rspack (SWC) en ambos runtimes.
 * `runtimeChunk: false` en browser para que el runtime de rspack se inline en cada chunk.
 *
 * @param runtime    - Runtime del bundle.
 * @param desarrollo - `true` en entorno de desarrollo (desactiva la minificación).
 * @throws {Error} Si el runtime no está soportado.
 */
export function Optimization(runtime: Runtime, desarrollo: boolean): TOptimization {
    switch (runtime) {
        case Runtime.node:
            return buildNode(desarrollo);
        case Runtime.browser:
            return buildBrowser(desarrollo);
        default:
            throw new Error(`Runtime no soportado: ${runtime}`);
    }
}
