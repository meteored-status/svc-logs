import {Target as TTarget} from "@rspack/core";

import {Runtime} from "../manifest/workspace/deployment";

export class Target {
    /* STATIC */
    public static build(runtime: Runtime): TTarget {
        switch (runtime) {
            case Runtime.node:
                return 'node';
            case Runtime.browser:
                return ["web", "es5"];
            default:
                throw new Error(`Runtime no soportado: ${runtime}`);
        }
    }

    /* INSTANCE */
}
