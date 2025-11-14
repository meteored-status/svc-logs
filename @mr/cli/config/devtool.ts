import {DevTool as TSourceMap} from "@rspack/core";

import {Runtime} from "../manifest/workspace/deployment";

export class Devtool {
    /* STATIC */
    public static build(runtime: Runtime, entornos: string[], entorno: string): TSourceMap {
        switch (runtime) {
            case Runtime.node:
                return "source-map";
            case Runtime.browser:
                return entornos.includes(entorno) ? "source-map" : false;
            default:
                return false;
        }
    }
}
