import MiniCssExtractPlugin from "mini-css-extract-plugin";
import {WebpackManifestPlugin} from "webpack-manifest-plugin";
import webpack from "webpack";

import {BuildFW} from "../manifest/workspace/build";
import {Runtime} from "../manifest/workspace/deployment";

interface IPluginsConfig {
    entorno: string;
    desarrollo: boolean;
    database?: string;
    prefix?: string;
    css: boolean;
}

export class Plugins {
    /* STATIC */
    protected static buildNode(): webpack.WebpackPluginInstance[] {
        return [];
    }

    protected static buildBrowser(prefix: string): webpack.WebpackPluginInstance[] {
        return [
            new WebpackManifestPlugin({
                fileName: 'stats.json',
                filter: (obj)=>!obj.path.includes('.js.map'),
                generate: (seed, files, entrypoints)=>{
                    const entrypoints_final: Record<string, string[]> = {
                        "_": files.map(elemento=>elemento.path.replace("auto/", "")),
                    };
                    for (let actual in entrypoints) {
                        // noinspection JSUnfilteredForInLoop
                        entrypoints_final[actual+".js"] = entrypoints[actual]
                            .filter((elemento)=>!elemento.includes(".js.map"))
                            .map((elemento)=>`/${prefix}js/bundle/${elemento}`);
                    }
                    return entrypoints_final;
                },
            })
        ];
    }

    public static build(runtime: Runtime, framework: BuildFW, {entorno, desarrollo, database, prefix = "", css}: IPluginsConfig): webpack.WebpackPluginInstance[] {
        const salida: webpack.WebpackPluginInstance[] = [];
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

        salida.push(new webpack.DefinePlugin({
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
                new MiniCssExtractPlugin({
                    filename: "[name].css",
                    // filename: !produccion?"[name].css":"[name]/[contenthash].css",
                }),
            )
        }

        return salida;
    }

    /* INSTANCE */
}
