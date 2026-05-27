/**
 * Editor: José Antonio Jiménez
 * Fecha: Thu, 21 May 2026 06:51:30 GMT
 * Hash: 2b15f8defd053a50c0fa1a4ee0ba5d80
 * Versión: 2026.5.21+1-josantoniojimnez
 */

import {type Configuration} from "@rspack/core";

import type {BuildFW} from "@mr/core-dev/manifest/build";
import type {Runtime} from "@mr/core-dev/manifest/deployment";
import type {ManifestBuildBundleBase} from "@mr/core-dev/manifest/build/bundle/base";
import {ManifestBuildComponentesCSS} from "@mr/core-dev/manifest/build/bundle/componentes";

import {Devtool} from "./devtool.ts";
import {Entry} from "./entry.ts";
import {Externals} from "./externals.ts";
import {Module} from "./module.ts";
import {Optimization} from "./optimization.ts";
import {Output} from "./output.ts";
import {Target} from "./target.ts";
import plugins from "./plugins.ts";

/**
 * Parámetros para construir una configuración de rspack.
 *
 * @property basedir      - Directorio raíz del workspace.
 * @property bundle       - Configuración del bundle (`mrpack.json → build.bundle`).
 * @property dependencies - Dependencias del `package.json` del workspace.
 * @property entorno      - Nombre del entorno activo (`"desarrollo"`, `"test"`, `"produccion"`…).
 * @property framework    - Framework de compilación (`meteored`, `nextjs`).
 * @property runtime      - Runtime del bundle (`node`, `browser`…).
 * @property database     - Nombre de la BD activa para el entorno (inyectado como `DATABASE`).
 * @property rules        - Ruta a un fichero `rules.js` con reglas de loader adicionales.
 */
interface IConfiguracionConfig {
    basedir: string;
    bundle: ManifestBuildBundleBase;
    dependencies: Record<string, string>;
    entorno: string;
    framework: BuildFW;
    runtime: Runtime;
    database?: string;
    rules?: string;
}

/**
 * Construye la configuración completa de rspack para un bundle individual.
 *
 * - En modo **desarrollo** activa `watch` con un `aggregateTimeout` de 1 segundo
 *   e ignora los directorios que no contienen código TypeScript.
 * - Las variables globales (`PRODUCCION`, `TEST`, `DESARROLLO`, etc.) se inyectan
 *   mediante `DefinePlugin` (ver `plugins.ts`).
 *
 * @param config - Parámetros del bundle.
 * @returns Configuración de rspack lista para exportar desde `rspack.config.ts`.
 */
export default ({basedir, bundle, dependencies, entorno, framework, runtime, database, rules}: IConfiguracionConfig): Configuration => {
    const desarrollo = !["produccion", "test"].includes(entorno);
    const test = ["desarrollo", "test"].includes(entorno);
    const mode = desarrollo ? "development" : "production";

    const salida: Configuration = {
        cache: true,
        entry: Entry(runtime, framework, {
            basedir,
            entries: bundle.entries,
        }),
        output: Output.build(runtime, {
            basedir,
            desarrollo,
            cssCritico: bundle.componentes.css === ManifestBuildComponentesCSS.CRITICAL,
        }),
        mode,
        optimization: bundle.componentes.optimizar ? Optimization(runtime, desarrollo) : {},
        resolve: {
            extensions: [".ts", ".js", ".tsx", ".jsx"],
            extensionAlias: {
                ".js":  [".js", ".ts"],
                ".cjs": [".cjs", ".cts"],
                ".mjs": [".mjs", ".mts"],
            },
        },
        devtool: Devtool(runtime, bundle.source_map ?? ["desarrollo", "test"], entorno),
        module: Module({
            componentes: bundle.componentes,
            desarrollo,
            test,
            rules,
        }),
        plugins: plugins(runtime, framework, {
            basedir,
            entorno,
            desarrollo,
            database,
            prefix: bundle.prefix,
            css: bundle.componentes.css !== ManifestBuildComponentesCSS.DESACTIVADO,
        }),
        stats: "minimal",
        externals: Externals(runtime, dependencies),
        target: Target(runtime),
    };

    if (desarrollo) {
        salida.watch = true;
        salida.watchOptions = {
            aggregateTimeout: 1000,
            ignored: [
                ".yarn/*",
                ".yarn/**/*",
                "@mr/cli/**/*",
                "assets/*",
                "assets/**/*",
                "files/*",
                "files/**/*",
                "mapping/*",
                "mapping/**/*",
                "output/*",
                "output/**/*",
                "**/.yarn/*",
                "**/.yarn/**/*",
                "**/@mr/cli/**/*",
                "**/assets/*",
                "**/assets/**/*",
                "**/files/*",
                "**/files/**/*",
                "**/mapping/*",
                "**/mapping/**/*",
                "**/output/*",
                "**/output/**/*",
            ],
        };
    }

    return salida;
};
