import {Configuration} from "@rspack/core";

import {BuildFW} from "../manifest/workspace/build";
import {Devtool} from "./devtool";
import {Entry} from "./entry";
import {Externals} from "./externals";
import type {ManifestBuildBundleBase} from "../manifest/workspace/build/bundle/base";
import {ManifestBuildComponentesCSS} from "../manifest/workspace/build/bundle/componentes";
import {Module} from "./module";
import {Optimization} from "./optimization";
import {Output} from "./output";
import {Plugins} from "./plugins";
import {Runtime} from "../manifest/workspace/deployment";
import {Target} from "./target";

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

export class Configuracion {
    /* STATIC */
    public static build({basedir, bundle, dependencies, entorno, framework, runtime, database, rules}: IConfiguracionConfig): Configuration {
        const desarrollo = !["produccion", "test"].includes(entorno);
        const test = ["desarrollo","test"].includes(entorno);
        const mode = desarrollo ? "development" : "production";

        const salida: Configuration = {
            cache: true,
            entry: Entry.build(runtime, framework, {
                basedir,
                entries: bundle.entries,
            }),
            output: Output.build(runtime, {
                basedir,
                desarrollo,
                css_critico: bundle.componentes.css==ManifestBuildComponentesCSS.CRITICAL,
            }),
            mode,
            optimization: bundle.componentes.optimizar ? Optimization.build(runtime, desarrollo) : {},
            resolve: {
                extensions: ['.ts', '.js', '.tsx', '.jsx'],
                extensionAlias: {
                    ".js": [".js", ".ts"],
                    ".cjs": [".cjs", ".cts"],
                    ".mjs": [".mjs", ".mts"]
                }
            },
            devtool: Devtool.build(runtime, bundle.source_map??["desarrollo", "test"], entorno),
            module: Module.build({
                componentes: bundle.componentes,
                desarrollo,
                test,
                rules,
            }),
            plugins: Plugins.build(runtime, framework, {
                basedir,
                entorno,
                desarrollo,
                database,
                prefix: bundle.prefix,
                css: bundle.componentes.css!=ManifestBuildComponentesCSS.DESACTIVADO,
            }),
            stats: "minimal",
            externals: Externals.build(runtime, dependencies),
            target: Target.build(runtime),
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
                    "**@mr/cli/**/*",
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
    }
    /* INSTANCE */
}
