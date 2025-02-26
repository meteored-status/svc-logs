import webpack from "webpack";

import {Runtime} from "../manifest/workspace/deployment";

type TSourceMap = webpack.Configuration['devtool'];

export class Devtool {
    /* STATIC */
    public static build(runtime: Runtime, entornos: string[], entorno: string): TSourceMap {
        switch (runtime) {
            case Runtime.node:
            case Runtime.browser:
                return entornos.includes(entorno) ? "source-map" : false;
            default:
                return "source-map";
        }
    }
}
