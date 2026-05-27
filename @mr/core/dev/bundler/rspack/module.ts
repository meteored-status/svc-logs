/**
 * Editor: José Antonio Jiménez
 * Fecha: Fri, 22 May 2026 05:52:12 GMT
 * Hash: 8f0ee6f65d20e7c2906eb4d97a490f35
 * Versión: 2026.5.22+1-josantoniojimnez
 * Anterior: 2026.5.21+1-josantoniojimnez
 */

import {CssExtractRspackPlugin, type ModuleOptions} from "@rspack/core";
import {createRequire} from 'node:module';

import {type ManifestBuildComponentes, ManifestBuildComponentesCSS} from "@mr/core-dev/manifest/build/bundle/componentes"

const require = createRequire(import.meta.url);

/**
 * Configuración de los loaders de rspack.
 *
 * @property componentes - Configuración de componentes (CSS, Pug, etc.).
 * @property desarrollo  - `true` en entorno de desarrollo (activa salidas más legibles).
 * @property test        - `true` en entornos de desarrollo y test (activa source maps de CSS).
 * @property rules       - Ruta opcional a un fichero `rules.js` con reglas adicionales del workspace.
 */
interface IModuleConfig {
    componentes: ManifestBuildComponentes;
    desarrollo: boolean;
    test: boolean;
    rules?: string;
}

/**
 * Genera la sección `module` (loaders) de la configuración de rspack.
 *
 * Loaders incluidos según la configuración de `componentes`:
 *
 * - **Pug** (`pug3-loader`) — si `componentes.pug === true`.
 * - **Imágenes/fuentes** — si CSS está activo: `asset/inline` para CSS crítico, `asset/resource` para el resto.
 * - **CSS** (`css-loader` + `style-loader` o `CssExtractRspackPlugin.loader`).
 * - **SCSS/SASS** (`sass-loader` con implementación `dart-sass` + `css-loader` + loader de salida).
 * - **TypeScript** (`builtin:swc-loader` — integrado en rspack, sin dependencia externa).
 * - **Reglas adicionales** del workspace cargadas desde `rules.js` si existe.
 *
 * @param config - Configuración de loaders.
 * @returns Opciones de módulo con todas las reglas configuradas.
 */
export function Module({componentes, desarrollo, test, rules}: IModuleConfig): ModuleOptions {
    const ruleSet: NonNullable<ModuleOptions["rules"]> = [];

    if (componentes.pug) {
        ruleSet.push({
            test: /\.pug$/,
            use: [
                {
                    loader: require.resolve("pug3-loader"),
                    options: {
                        pretty: desarrollo,
                    },
                },
            ],
        });
    }

    if (componentes.css !== ManifestBuildComponentesCSS.DESACTIVADO) {
        ruleSet.push({
            test: /\.(png|jpe?g|gif|svg|eot|ttf|woff)$/i,
            type: componentes.css === ManifestBuildComponentesCSS.CRITICAL ? "asset/inline" : "asset/resource",
        });

        const cssOutputLoader = componentes.css === ManifestBuildComponentesCSS.INYECTADO
            ? require.resolve("style-loader")
            : CssExtractRspackPlugin.loader;

        ruleSet.push({
            test: /\.css$/,
            use: [
                {loader: cssOutputLoader},
                {
                    loader: require.resolve("css-loader"),
                    options: {sourceMap: test},
                },
            ],
        });

        ruleSet.push({
            test: /\.s[ac]ss$/i,
            use: [
                ...(componentes.css === ManifestBuildComponentesCSS.STRING
                    ? [{loader: require.resolve("to-string-loader")}]
                    : [{loader: cssOutputLoader}]
                ),
                {
                    loader: require.resolve("css-loader"),
                    options: {sourceMap: test},
                },
                {
                    loader: require.resolve("sass-loader"),
                    options: {
                        implementation: require.resolve("sass-embedded"),
                        api: "modern-compiler",
                        sassOptions: {
                            outputStyle: componentes.css === ManifestBuildComponentesCSS.CRITICAL || !desarrollo
                                ? "compressed"
                                : "expanded",
                        },
                        sourceMap: test,
                    },
                },
            ],
            type: "javascript/auto",
        });
    }

    ruleSet.push({
        test: /\.([cm]?ts|tsx)$/,
        exclude: [/node_modules/],
        loader: "builtin:swc-loader",
        options: {
            detectSyntax: 'auto',
            jsc: {
                parser: {
                    syntax: "typescript",
                    decorators: true,
                },
                transform: {
                    decoratorMetadata: true,
                },
            },
        },
        type: "javascript/auto",
    });

    if (rules !== undefined) {
        // DD-IGNORE[non-literal-require] — ruta validada por isFileSync en rspack.config.ts
        ruleSet.push(...require(rules));
    }

    return {rules: ruleSet};
}
