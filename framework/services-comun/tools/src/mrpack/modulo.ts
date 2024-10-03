import {parseArgs, ParseArgsConfig} from "node:util";

import {PromiseDelayed} from "../../../modules/utiles/promise";

export interface IModuloConfig extends ParseArgsConfig {
    options: {
        help: { type: "boolean", short: "h", default: false, };
    };
}

export interface IModulo {
    help: boolean;
}

export abstract class Modulo<T extends IModuloConfig> {
    /* STATIC */
    protected static OPTIONS: IModuloConfig = {
        options: {
            help: { type: "boolean", short: "h", default: false, },
        },
        strict: true,
        allowPositionals: true,
    };

    public static run<T extends IModuloConfig>(modulo: Modulo<T>): void {
        PromiseDelayed()
            .then(async ()=>modulo.run())
            .catch((err)=>{
                if (err!=undefined) {
                    console.error(err)
                // } else {
                //     modulo.mostrarAyuda();
                }
            });
    }

    /* INSTANCE */
    public readonly root: string;

    protected constructor(protected config: T) {
        this.root = process.cwd();
    }

    protected async run(): Promise<void> {
        const {values, positionals} = parseArgs<T>(this.config);
        await this.parsePositionals(positionals);
        await this.parseParams(values as IModulo, positionals);
    }

    protected async parsePositionals(positionals: string[]): Promise<void> {

    }

    protected abstract parseParams(config: IModulo, positionals?: string[]): Promise<void>;
    protected abstract mostrarAyuda(): void;
}
