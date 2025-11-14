import {Entry as TEntry} from "@rspack/core";

import {BuildFW} from "../manifest/workspace/build";
import {Runtime} from "../manifest/workspace/deployment";

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

    public static build(runtime: Runtime, framework: BuildFW, config: IEntryConfig): TEntry {
        switch (runtime) {
            case Runtime.node:
                switch (framework) {
                    case BuildFW.meteored:
                        return this.buildNodeMeteored(config);
                    case BuildFW.nextjs:
                        return {};
                    default:
                        throw new Error(`Framework no soportado: ${framework}`);
                }
            case Runtime.browser:
                return this.buildBrowser(config);
            default:
                throw new Error(`Runtime no soportado: ${runtime}`);
        }
    }

    /* INSTANCE */
}
