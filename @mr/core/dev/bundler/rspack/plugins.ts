/**
 * Editor: Bixus
 * Fecha: Wed, 23 Sep 2026 08:46:25 GMT
 * Hash: 1d81582150a1bb7612838cd42583db23
 * Versión: 2026.9.23+2-bixus
 * Anterior: 2026.5.21+1-josantoniojimnez
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

import {RspackManifestPlugin} from "rspack-manifest-plugin";
import {TsCheckerRspackPlugin} from "ts-checker-rspack-plugin";
import rspack, {CssExtractRspackPlugin, type Plugins as TPlugins} from "@rspack/core";

import {BuildFW} from "@mr/core-dev/manifest/build";
import {Runtime} from "@mr/core-dev/manifest/deployment";

/**
 * Parámetros para construir los plugins de rspack.
 *
 * @property basedir    - Directorio raíz del workspace.
 * @property entorno    - Nombre del entorno activo.
 * @property desarrollo - `true` en entorno de desarrollo.
 * @property database   - Nombre de la BD inyectado en `DATABASE`.
 * @property prefix     - Prefijo de URL pública para los assets del bundle browser.
 * @property css        - `true` si se debe activar `CssExtractRspackPlugin`.
 */
interface IPluginsConfig {
    basedir: string;
    entorno: string;
    desarrollo: boolean;
    database?: string;
    prefix?: string;
    css: boolean;
}

/**
 * Genera el manifest de assets para bundles browser.
 *
 * Produce un fichero `stats.json` con dos secciones:
 * - `"_"`: lista de todos los ficheros generados (sin `.js.map`).
 * - `"<entry>.js"`: lista de URLs públicas para cada punto de entrada.
 *
 * @param prefix - Prefijo de URL pública (p. ej. `"/static/"`).
 */
function buildBrowser(prefix: string): TPlugins {
    return [
        new RspackManifestPlugin({
            fileName: "stats.json",
            filter: (obj) => !obj.path.includes(".js.map"),
            generate: (_, files, entries) => {
                const entrypointsFinal: Record<string, string[]> = {
                    "_": files.map((elemento) => elemento.path.replace("auto/", "")),
                };
                for (const actual of Object.keys(entries)) {
                    entrypointsFinal[`${actual}.js`] = entries[actual]
                        .filter((elemento) => !elemento.includes(".js.map"))
                        .map((elemento) => `/${prefix}js/bundle/${elemento}`);
                }
                return entrypointsFinal;
            },
        }),
    ];
}

/**
 * Bandera de módulo para garantizar que `TsCheckerRspackPlugin` se registra
 * una sola vez aunque se generen múltiples configuraciones de bundle en el mismo proceso.
 */
let tsCheckerRegistered = false;

/**
 * Construye el array de plugins de rspack para un bundle.
 *
 * Plugins siempre incluidos:
 * - `DefinePlugin` — inyecta `DESARROLLO`, `TEST`, `PRODUCCION`, `ENTORNO`, `NEXTJS`, `DATABASE`.
 *
 * Plugins condicionales:
 * - `RspackManifestPlugin` — solo en bundles browser.
 * - `TsCheckerRspackPlugin` — solo en el primer bundle del proceso (comprueba todos los tipos).
 * - `CssExtractRspackPlugin` — cuando `css === true`.
 *
 * @param runtime    - Runtime del bundle.
 * @param framework  - Framework de compilación.
 * @param config     - Parámetros del bundle.
 * @returns Array de plugins de rspack.
 */
export default (runtime: Runtime, framework: BuildFW, {basedir, entorno, desarrollo, database, prefix = "", css}: IPluginsConfig): TPlugins => {
    const salida: TPlugins = [];
    let nextjs: boolean;

    switch (runtime) {
        case Runtime.node:
            nextjs = framework === BuildFW.nextjs;
            break;
        case Runtime.browser:
            salida.push(...buildBrowser(prefix));
            nextjs = false;
            break;
        default:
            throw new Error(`Runtime no soportado: ${runtime}`);
    }

    if (!tsCheckerRegistered) {
        tsCheckerRegistered = true;
        salida.push(new TsCheckerRspackPlugin({
            typescript: {
                configFile: `${basedir}/tsconfig.json`,
            },
        }));
    }

    salida.push(new rspack.DefinePlugin({
        DESARROLLO:        JSON.stringify(entorno === "desarrollo"),
        TEST:              JSON.stringify(entorno === "test"),
        PRODUCCION:        JSON.stringify(!desarrollo),
        ENTORNO:           JSON.stringify(entorno),
        NEXTJS:            JSON.stringify(nextjs),
        DATABASE:          JSON.stringify(database),
        "global.DESARROLLO": JSON.stringify(entorno === "desarrollo"),
        "global.TEST":       JSON.stringify(entorno === "test"),
        "global.PRODUCCION": JSON.stringify(!desarrollo),
        "global.ENTORNO":    JSON.stringify(entorno),
        "global.NEXTJS":     JSON.stringify(nextjs),
        "global.DATABASE":   JSON.stringify(database),
    }));

    if (css) {
        salida.push(new CssExtractRspackPlugin({
            filename: "[name].css",
        }));
    }

    return salida;
};
