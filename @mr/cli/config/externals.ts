import webpack from "webpack";

import {Runtime} from "../manifest/workspace/deployment";

type TExternals = webpack.Configuration["externals"];

export class Externals {
    /* STATIC */
    private static ES_MODULES: Record<string, string> = {
        "formidable": "3",
        "pdf-merger-js": "5",
        // "mysql": "3",
    };

    protected static buildNode(dependencies: Record<string, string>): TExternals {
        function check(actual: string , version: string ): boolean {
            return actual.startsWith(`^${version}.`)
                || actual.startsWith(`~${version}.`)
                || actual.startsWith(`${version}.`);
        }

        const commonjs: string[] = [];
        const salida: TExternals = [];
        for (let mod in dependencies) {
            if (this.ES_MODULES[mod]==undefined || !check(dependencies[mod], this.ES_MODULES[mod])) {
                salida.push({[mod]: `commonjs ${mod}`});
                commonjs.push(mod);
                // salida[mod] = `commonjs ${mod}`;
            // } else {
            //     salida.push({[mod]: `node-commonjs ${mod}`});
            //     // salida[mod] = `module ${mod}`;
            }
        }
        salida.push(function({request}, callback) {
            if (request==null) {
                return callback();
            }
            for (let mod of commonjs) {
                if (request.startsWith(mod)) {
                    return callback(null, `commonjs ${request}`);
                }
            }
            callback();
        });
        // for (const [lib, version] of Object.entries(this.ES_MODULES)) {
        //     if (dependencies[lib]!=undefined && check(dependencies[lib]!, version)) {
        //         delete salida[lib];
        //     }
        // }
        return salida;
    }

    protected static buildBrowser(): TExternals {
        return {};
    }

    public static build(runtime: Runtime, dependencies: Record<string, string>={}): TExternals {
        switch (runtime) {
            case Runtime.node:
                return this.buildNode(dependencies);
            case Runtime.browser:
                return this.buildBrowser();
            default:
                throw new Error(`Runtime no soportado: ${runtime}`);
        }
    }

    /* INSTANCE */
}
