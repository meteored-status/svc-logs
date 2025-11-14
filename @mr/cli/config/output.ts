import path from "node:path";
import {Filename, Output as TOutput} from "@rspack/core";

import {Runtime} from "../manifest/workspace/deployment";

interface IOutputConfig {
    basedir: string;
    desarrollo: boolean;
    css_critico: boolean;
}

export class Output {
    /* STATIC */
    protected static buildNode({basedir}: IOutputConfig): TOutput {
        return new this('[name].js', basedir, 'output', false);
    }

    protected static buildBrowser({basedir, desarrollo, css_critico}: IOutputConfig): TOutput {
        const output: string = !css_critico?"output/bundle":"output/critical";
        const filename: string = desarrollo?'[name].js':'[name]/[contenthash].js';

        return new this(filename, basedir, output, true/*, (pathData: PathData): string => {
            let id = desarrollo?
                `${pathData.chunk.id}`:
                `${pathData.chunk.name}/${pathData.chunk.renderedHash}`;
            if (!id.startsWith("module/") && !id.startsWith("i18n/") && !id.startsWith("site/")) {
                if (id=="network") {
                    id =  `common/${id}`;
                } else {
                    const nombre = desarrollo ?
                        `common/chunk/${pathData.chunk.id}.js` :
                        `common/chunk/${pathData.chunk.renderedHash}.js`;
                    return nombre.replace("undefined/", "");
                }
            }

            const name = id.replace(/-/g, "/");
            return `${name}.js`;
        }*/);
    }

    public static build(runtime: Runtime, config: IOutputConfig): TOutput {
        switch (runtime) {
            case Runtime.node:
                return this.buildNode(config);
            case Runtime.browser:
                return this.buildBrowser(config);
            default:
                throw new Error(`Runtime no soportado: ${runtime}`);
        }
    }

    /* INSTANCE */
    public readonly uniqueName: string;
    public readonly path: string;

    public readonly chunkFilename?: Filename;

    public constructor(public readonly filename: Filename, basedir: string, output: string, public readonly clean: boolean, chunkFilename?: Filename) {
        this.chunkFilename = chunkFilename;
        this.path = path.resolve(basedir, output);
        this.uniqueName = path.basename(basedir);
    }
}
