import webpack from "webpack";

import {ERuntime} from "../tools/src/clases/workspace/service";

type TExternals = webpack.Configuration["externals"];

export class Externals {
    /* STATIC */
    protected static buildNode(dependencies: NodeJS.Dict<string>): TExternals {
        const salida: TExternals = {};
        for (let mod in dependencies) {
            salida[mod] = `commonjs ${mod}`;
        }
        if (dependencies["formidable"]!==undefined && (dependencies["formidable"].startsWith("^3.") || dependencies["formidable"].startsWith("3."))) {
            delete salida["formidable"];
        }
        return salida;
    }

    protected static buildBrowser(): TExternals {
        return {};
    }

    public static build(runtime: ERuntime, dependencies: NodeJS.Dict<string>={}): TExternals {
        switch (runtime) {
            case ERuntime.node:
                return this.buildNode(dependencies);
            case ERuntime.browser:
                return this.buildBrowser();
            default:
                throw new Error(`Runtime no soportado: ${runtime}`);
        }
    }

    /* INSTANCE */
}
