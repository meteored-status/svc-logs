// import TerserPlugin from "terser-webpack-plugin";
import {Optimization as TOptimization} from "@rspack/core";

import {Runtime} from "../manifest/workspace/deployment";

export class Optimization {
    /* STATIC */
    protected static buildNode(desarrollo: boolean): TOptimization {
        return {
            concatenateModules: false,
            minimize: !desarrollo,
            // minimizer: [
            //     new TerserPlugin({
            //         terserOptions: {
            //             // mangle: {
            //             //     properties: {
            //             //         regex: /.*/,
            //             //         reserved: [
            //             //             "env",
            //             //             "setMaxListeners",
            //             //             "pipeline",
            //             //             "promisify",
            //             //         ],
            //             //     }
            //             // },
            //             compress: {
            //                 // keep_fargs: false,
            //                 passes: 10,
            //                 // toplevel: true,
            //                 // top_retain: [
            //                 // ],
            //                 unused: true,
            //             },
            //         },
            //     }),
            // ],
        };
    }

    protected static buildBrowser(desarrollo: boolean): TOptimization {
        return {
            concatenateModules: true,
            minimize: !desarrollo,
            // minimizer: [
            //     new TerserPlugin({
            //         terserOptions: {
            //             compress: {
            //                 // keep_fargs: false,
            //                 passes: 10,
            //                 // toplevel: true,
            //                 // top_retain: [
            //                 // ],
            //                 unused: true,
            //             },
            //         },
            //     }),
            // ],
            runtimeChunk: false,
            splitChunks: {
                cacheGroups: {
                    // network: {
                    //     test: /[\\/]services-comun[\\/]modules\/net[\\/]/,
                    //     name: 'network',
                    //     chunks: 'all',
                    // },
                    vendor: {
                        test: /[\\/]node_modules[\\/]/,
                        name: 'vendor',
                        chunks: 'all',
                    },
                },
                chunks: 'all',
            },
        };
    }

    public static build(runtime: Runtime, desarrollo: boolean): TOptimization {
        switch (runtime) {
            case Runtime.node:
                return this.buildNode(desarrollo);
            case Runtime.browser:
                return this.buildBrowser(desarrollo);
            default:
                throw new Error(`Runtime no soportado: ${runtime}`);
        }
    }

    /* INSTANCE */
}
