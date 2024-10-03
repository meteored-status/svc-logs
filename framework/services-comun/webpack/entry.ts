import webpack from "webpack";

import {EFramework, ERuntime} from "../tools/src/mrpack/clases/workspace/service";

type TEntry = webpack.Configuration["entry"];

interface IEntryConfig {
    basedir: string;
    entries?: NodeJS.Dict<string>;
}

export class Entry {
    /* STATIC */
    protected static buildNodeMeteored({basedir}: IEntryConfig): TEntry {
        return {
            app: `${basedir}/main.ts`
        };
    }

    protected static buildBrowser({basedir, entries={}}: IEntryConfig): TEntry {
        const salida: TEntry = {};

        for (const [key, value] of Object.entries(entries)) {
            if (value==undefined) {
                continue;
            }
            if (value.startsWith("/") || value.startsWith(".")) {
                salida[key] = `${basedir}${value}`;
            } else {
                salida[key] = require.resolve(value, {
                    paths: [basedir],
                });
            }
        }

        return salida;
    }

    public static build(runtime: ERuntime, framework: EFramework, config: IEntryConfig): TEntry {
        switch (runtime) {
            case ERuntime.node:
                switch (framework) {
                    case EFramework.meteored:
                        return this.buildNodeMeteored(config);
                    case EFramework.nextjs:
                        return {};
                    default:
                        throw new Error(`Framework no soportado: ${framework}`);
                }
            case ERuntime.browser:
                return this.buildBrowser(config);
            default:
                throw new Error(`Runtime no soportado: ${runtime}`);
        }
    }

    /* INSTANCE */
}
