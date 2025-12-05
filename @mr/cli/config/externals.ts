import {Externals as TExternals} from "@rspack/core";

import {Runtime} from "../manifest/workspace/deployment";

export class Externals {
    /* STATIC */
    private static ES_MODULES: Record<string, string> = {
        "@inquirer/prompts": "8",
        "chokidar": "5",
        "formidable": "3",
        "mime": "4",
        "pdf-merger-js": "5",
        "uuid": "13",
        // "mysql": "3",
    };

    protected static buildNode(dependencies: Record<string, string>): TExternals {
        function check(actual: string , version: string ): boolean {
            return actual.startsWith(`^${version}.`)
                || actual.startsWith(`~${version}.`)
                || actual.startsWith(`${version}.`);
        }

        const commonjs: string[] = [];
        const modules: string[] = [];
        const salida: TExternals = [];
        for (let mod in dependencies) {
            if (this.ES_MODULES[mod]==undefined || !check(dependencies[mod], this.ES_MODULES[mod])) {
                salida.push({[mod]: `commonjs ${mod}`});
                commonjs.push(mod);
                // salida[mod] = `commonjs ${mod}`;
            } else {
                salida.push({[mod]: `module ${mod}`});
                modules.push(mod);
                // salida[mod] = `module ${mod}`;
            }
        }
        salida.push(function({request}, callback) {
            if (request==null) {
                return callback();
            }
            for (let mod of commonjs) {
                if (request.startsWith(mod)) {
                    return callback(undefined, `commonjs ${request}`);
                }
            }
            for (let mod of modules) {
                if (request.startsWith(mod)) {
                    return callback(undefined, `module ${request}`);
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
