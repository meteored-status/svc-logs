import {RspackManifestPlugin} from "rspack-manifest-plugin";
import {TsCheckerRspackPlugin} from "ts-checker-rspack-plugin";
import rspack, {CssExtractRspackPlugin, Plugins as TPlugins} from "@rspack/core";

import {BuildFW} from "../manifest/workspace/build";
import {Runtime} from "../manifest/workspace/deployment";

interface IPluginsConfig {
    basedir: string;
    entorno: string;
    desarrollo: boolean;
    database?: string;
    prefix?: string;
    css: boolean;
}

export class Plugins {
    /* STATIC */
    protected static buildNode(): TPlugins {
        return [];
    }

    protected static buildBrowser(prefix: string): TPlugins {
        return [
            new RspackManifestPlugin({
                fileName: 'stats.json',
                filter: (obj)=>!obj.path.includes('.js.map'),
                generate: (_, files, entries)=>{
                    const entrypoints_final: Record<string, string[]> = {
                        "_": files.map(elemento=>elemento.path.replace("auto/", "")),
                    };
                    for (let actual in entries) {
                        // noinspection JSUnfilteredForInLoop
                        entrypoints_final[actual+".js"] = entries[actual]
                            .filter((elemento)=>!elemento.includes(".js.map"))
                            .map((elemento)=>`/${prefix}js/bundle/${elemento}`);
                    }
                    return entrypoints_final;
                },
            }),
        ];
    }

    public static build(runtime: Runtime, framework: BuildFW, {basedir, entorno, desarrollo, database, prefix = "", css}: IPluginsConfig): TPlugins {
        const salida: TPlugins = [];
        let nextjs: boolean;

        switch (runtime) {
            case Runtime.node:
                salida.push(...this.buildNode());
                nextjs = framework==BuildFW.nextjs;
                break;
            case Runtime.browser:
                salida.push(...this.buildBrowser(prefix));
                nextjs = false;
                break;
            default:
                // throw new Error(`Runtime no soportado: ${runtime}`);
                nextjs = false;
                break;
        }

        salida.push(new TsCheckerRspackPlugin({
            typescript: {
                // configFile: `config/tsconfig.json`,
                configFile: `${basedir}/tsconfig.json`,
                // memoryLimit: 10*1024*1024*1024,
                // mode: "readonly",
                // mode: "write-references",
            },
        }));

        salida.push(new rspack.DefinePlugin({
            DESARROLLO: JSON.stringify(entorno==="desarrollo"),
            TEST: JSON.stringify(entorno==="test"),
            PRODUCCION: JSON.stringify(!desarrollo),
            ENTORNO: JSON.stringify(entorno),
            NEXTJS: JSON.stringify(nextjs),
            DATABASE: JSON.stringify(database),

            "global.DESARROLLO": JSON.stringify(entorno==="desarrollo"),
            "global.TEST": JSON.stringify(entorno==="test"),
            "global.PRODUCCION": JSON.stringify(!desarrollo),
            "global.ENTORNO": JSON.stringify(entorno),
            "global.NEXTJS": JSON.stringify(nextjs),
            "global.DATABASE": JSON.stringify(database),
        }));

        if (css) {
            salida.push(
                new CssExtractRspackPlugin({
                    filename: "[name].css",
                    // filename: !produccion?"[name].css":"[name]/[contenthash].css",
                }),
            )
        }

        return salida;
    }

    /* INSTANCE */
}
