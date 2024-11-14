import path from "node:path";
import webpack from "webpack";

import {ERuntime} from "../src/mrpack/clases/workspace/service";

type IOutput = webpack.Configuration["output"];
type ChunkFunction = string|((pathData: any, assetInfo?: any) => string);

interface IOutputConfig {
    basedir: string;
    desarrollo: boolean;
    css_critico: boolean;
}

export class Output {
    /* STATIC */
    protected static buildNode({basedir}: IOutputConfig): Output {
        return new this('[name].js', basedir, 'output');
    }

    protected static buildBrowser({basedir, desarrollo, css_critico}: IOutputConfig): Output {
        const output: string = !css_critico?"output/bundle":"output/critical";
        const filename: string = desarrollo?'[name].js':'[name]/[contenthash].js';

        return new this(filename, basedir, output, (pathData)=>{
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
        });
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

    public constructor(public readonly filename: string, basedir: string, output: string, public readonly chunkFilename?: ChunkFunction) {
        this.path = path.resolve(basedir, output);
        this.uniqueName = path.basename(basedir);
    }
}
