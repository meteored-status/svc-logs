import {Runtime} from "../manifest/workspace/deployment";

export class Target {
    /* STATIC */
    public static build(runtime: Runtime): string|string[] {
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
