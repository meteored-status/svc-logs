import {ERuntime} from "../tools/src/mrpack/clases/workspace/service";

export class Target {
    /* STATIC */
    public static build(runtime: ERuntime): string|string[] {
        switch (runtime) {
            case ERuntime.node:
                return 'node';
            case ERuntime.browser:
                return ["web", "es5"];
            default:
                throw new Error(`Runtime no soportado: ${runtime}`);
        }
    }

    /* INSTANCE */
}
