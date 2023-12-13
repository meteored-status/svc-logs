import webpack from "webpack";

import {ERuntime} from "../tools/src/clases/workspace/service";

type TOptimization = webpack.Configuration['optimization'];

export class Optimization {
    /* STATIC */
    protected static buildNode(): TOptimization {
        return {
            concatenateModules: false,
        };
    }

    protected static buildBrowser(): TOptimization {
        return {
            concatenateModules: true,
            runtimeChunk: 'single',
            splitChunks: {
                cacheGroups: {
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

    public static build(runtime: ERuntime): TOptimization {
        switch (runtime) {
            case ERuntime.node:
                return this.buildNode();
            case ERuntime.browser:
                return this.buildBrowser();
            default:
                throw new Error(`Runtime no soportado: ${runtime}`);
        }
    }

    /* INSTANCE */
}
