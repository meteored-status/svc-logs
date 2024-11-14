import {Colors} from "../../mrpack/clases/colors";
import type {IModulo, IModuloConfig} from "../../mrpack/modulo";
import {Modulo} from "../modulo";

export interface IPullConfig extends IModuloConfig {
    options: IModuloConfig["options"] & {
        modulo: { type: "string", short: "m", multiple: true, };
    };
}

export interface IPull extends IModulo {
    modulo?: string[];
}

export class ModuloPull<T extends IPullConfig> extends Modulo<T> {
    /* STATIC */
    protected static override OPTIONS: IPullConfig = {
        ...Modulo.OPTIONS,
        options: {
            ...Modulo.OPTIONS.options,
            modulo: { type: "string", short: "m", multiple: true, },
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

    protected async parseParams(config: IPull): Promise<void> {
        if (config.help) {
            this.mostrarAyuda();
        } else {
            const {Pull} = await import(/* webpackChunkName: "mrlang/pull" */ "../clases/pull");
            await Pull.run(this.root, config.modulo);
        }
    }

    protected mostrarAyuda(): void {
        console.log(`${Colors.colorize([Colors.FgCyan, Colors.Bright], "Descripción")}: Actualiza los ficheros de traducción locales.`);
        console.log(`${Colors.colorize([Colors.FgCyan, Colors.Bright], "Uso")}:         ${Colors.colorize([Colors.FgBlue], "yarn mrlang")} ${Colors.colorize([Colors.FgGreen], "pull")} ${Colors.colorize([Colors.FgYellow], "[opciones]")}`);
        console.log("");
        console.group();

        console.log(`${Colors.colorize([Colors.FgYellow], "[opciones]")}:`);
        console.group();
        console.log(`${Colors.colorize([Colors.FgMagenta], "Opciones disponibles:")}`);
        console.group();
        console.log(`${Colors.colorize([Colors.FgBlue], "-m")} ${Colors.colorize([Colors.FgYellow], "--modulo")}=${Colors.colorize([Colors.FgGreen], "<modulo>")}:       Indica el módulo a cargar`);
        console.log(`                            ${Colors.colorize([Colors.FgWhite], "Se puede especificar múltiples veces para indicar mútiples módulos")}`);
        console.log(`${Colors.colorize([Colors.FgBlue], "-h")} ${Colors.colorize([Colors.FgYellow], "--help")}:                  Muestra la ayuda`);
        console.groupEnd();
        console.groupEnd();
        console.log("");

        console.groupEnd();
    }
}
