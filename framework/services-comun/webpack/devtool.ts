import webpack from "webpack";
import {ERuntime} from "../tools/src/mrpack/clases/workspace/service";

type TSourceMap = webpack.Configuration['devtool'];

export class Devtool {
    /* STATIC */
    public static build(runtime: ERuntime, entornos: string[], entorno: string): TSourceMap {
        switch (runtime) {
            case ERuntime.node:
            case ERuntime.browser:
                return entornos.includes(entorno) ? "source-map" : false;
            default:
                return "source-map";
        }
    }
}
