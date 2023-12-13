import path from "node:path";

import {ERuntime} from "../tools/src/clases/workspace/service";

interface IOutput {
    filename: string;
    path: string;
    uniqueName: string;
}

interface IOutputConfig {
    basedir: string;
    desarrollo: boolean;
    css_critico: boolean;
}

export class Output implements IOutput {
    /* STATIC */
    protected static buildNode({basedir}: IOutputConfig): Output {
        return new this('[name].js', basedir, 'output');
    }

    protected static buildBrowser({basedir, desarrollo, css_critico}: IOutputConfig): Output {
        const output: string = !css_critico?"output/bundle":"output/critical";
        const filename: string = desarrollo?'[name].js':'[name]/[contenthash].js';

        return new this(filename, basedir, output);
    }

    public static build(runtime: ERuntime, config: IOutputConfig): Output {
        switch (runtime) {
            case ERuntime.node:
                return this.buildNode(config);
            case ERuntime.browser:
                return this.buildBrowser(config);
            default:
                throw new Error(`Runtime no soportado: ${runtime}`);
        }
    }

    /* INSTANCE */
    public readonly uniqueName: string;
    public readonly path: string;

    public constructor(public readonly filename: string, basedir: string, output: string) {
        this.path = path.resolve(basedir, output);
        this.uniqueName = path.basename(basedir);
    }
}
