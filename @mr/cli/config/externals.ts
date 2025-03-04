import webpack from "webpack";

import {Runtime} from "../manifest/workspace/deployment";

type TExternals = webpack.Configuration["externals"];

export class Externals {
    /* STATIC */
    private static ES_MODULES = {
        "formidable": "3",
        "pdf-merger-js": "5",
    };

    protected static buildNode(dependencies: NodeJS.Dict<string>): TExternals {
        function check(actual: string , version: string ): boolean {
            return actual.startsWith(`^${version}.`)
                || actual.startsWith(`~${version}.`)
                || actual.startsWith(`${version}.`);
        }

        const salida: TExternals = {};
        for (let mod in dependencies) {
            salida[mod] = `commonjs ${mod}`;
        }
        for (const [lib, version] of Object.entries(this.ES_MODULES)) {
            if (dependencies[lib]!=undefined && check(dependencies[lib]!, version)) {
                delete salida[lib];
            }
        }
        return salida;
    }

    protected static buildBrowser(): TExternals {
        return {};
    }

    public static build(runtime: Runtime, dependencies: NodeJS.Dict<string>={}): TExternals {
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
