import webpack from "webpack";
import {
    EFramework,
    ERuntime,
    IConfigServiceBundle, IConfigServiceComponentes,
} from "../tools/src/clases/workspace/service";
import {Entry} from "./entry";
import {Externals} from "./externals";
import {Module} from "./module";
import {Optimization} from "./optimization";
import {Output} from "./output";
import {Plugins} from "./plugins";
import {Target} from "./target";

type IConfiguracion = webpack.Configuration;

interface IConfiguracionConfig {
    basedir: string;
    bundle: IConfigServiceBundle;
    dependencies: NodeJS.Dict<string>;
    entorno: string;
    framework: EFramework;
    runtime: ERuntime;
}

export class Configuracion {
    /* STATIC */
    public static build({basedir, bundle, dependencies, entorno, framework, runtime}: IConfiguracionConfig): IConfiguracion {
        const desarrollo = !["produccion", "test"].includes(entorno);
        const test = ["desarrollo","test"].includes(entorno);
        const mode = desarrollo ? "development" : "production";
        const componentes: IConfigServiceComponentes = {
            optimizar: true,
            pug: false,
            css: false,
            css_type: 0, // 0=inyectado por JS | 1=archivo independiente | 2=critical
            ...bundle.componentes??{},
        };

        const salida: webpack.Configuration = {
            cache: {
                type: "memory",
            },
            entry: Entry.build(runtime, framework, {
                basedir,
                entries: bundle.entries,
            }),
            output: Output.build(runtime, {
                basedir,
                desarrollo,
                css_critico: componentes.css_type==2,
            }),
            mode,
            optimization: componentes.optimizar ? Optimization.build(runtime) : {},
            resolve: {
                extensions: ['.ts', '.js', '.tsx', '.jsx'],
                extensionAlias: {
                    ".js": [".js", ".ts"],
                    ".cjs": [".cjs", ".cts"],
                    ".mjs": [".mjs", ".mts"]
                }
            },
            devtool: "source-map",
            module: Module.build({
                ...componentes,
                desarrollo,
                test,
            }),
            plugins: Plugins.build(runtime, framework, {
                entorno,
                desarrollo,
                prefix: bundle.prefix,
                css: componentes.css,
            }),
            stats: "minimal",
            externals: Externals.build(runtime, dependencies),
            target: Target.build(runtime),
        };

        if (desarrollo) {
            salida.watch = true;
            salida.watchOptions = {
                aggregateTimeout: 1000,
                // ignored: /(\.yarn\/|files\/|output\/)/,
                ignored: [
                    ".yarn/*",
                    ".yarn/**/*",
                    "assets/*",
                    "assets/**/*",
                    "files/*",
                    "files/**/*",
                    "output/*",
                    "output/**/*",

                    "**/.yarn/*",
                    "**/.yarn/**/*",
                    "**/assets/*",
                    "**/assets/**/*",
                    "**/files/*",
                    "**/files/**/*",
                    "**/output/*",
                    "**/output/**/*",
                ],
            };
        }

        return salida;
    }
    /* INSTANCE */
}
