import {IModulo, IModuloConfig, Modulo} from "../modulo";
import type {IConfigEjecucion} from "../clases/devel";
import {Colors} from "../clases/colors";

export interface IAutoDocConfig extends IModuloConfig {
    options: IModuloConfig["options"] & {
        env: { type: "string", },
    };
}

export interface IAutoDoc extends IModulo, IConfigEjecucion {
    env: string;
}

export class ModuloAutoDoc<T extends IAutoDocConfig> extends Modulo<T> {
    /* STATIC */
    protected static override OPTIONS: IAutoDocConfig = {
        ...Modulo.OPTIONS,
        options: {
            ...Modulo.OPTIONS.options,
            env: { type: "string", },
        },
        strict: true,
    };

    public static override run(): void {
        super.run(new this(this.OPTIONS));
    }

    /* INSTANCE */
    protected constructor(config: T) {
        super (config);
    }

    protected async parseParams(config: IAutoDoc): Promise<void> {
        if (config.help) {
            this.mostrarAyuda();
            this.mostrarAyuda();
        } else {
            const {AutoDoc} = await import(/* webpackChunkName: "mrpack/auto-doc" */ "../clases/auto-doc");
            AutoDoc.run(this.root, {
                env: config.env,
            });
        }
    }

    protected mostrarAyuda(): void {
        console.log(`${Colors.colorize([Colors.FgCyan, Colors.Bright], "Descripción")}: Genera la documentación automática del proyecto`);
        console.log("");
        console.group();

        console.groupEnd();
    }

}
