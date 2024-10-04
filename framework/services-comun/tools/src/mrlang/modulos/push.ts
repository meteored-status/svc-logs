import {Colors} from "services-comun/tools/src/mrpack/clases/colors";
import type {IModulo, IModuloConfig} from "services-comun/tools/src/mrpack/modulo";

import {Modulo} from "../modulo";

export interface IPushConfig extends IModuloConfig {
    options: IModuloConfig["options"] & {
    };
}

export interface IPush extends IModulo {
}

export class ModuloPush<T extends IPushConfig> extends Modulo<T> {
    /* STATIC */
    protected static override OPTIONS: IPushConfig = {
        ...Modulo.OPTIONS,
        options: {
            ...Modulo.OPTIONS.options,
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

    protected async parseParams(config: IPush): Promise<void> {
        if (config.help) {
            this.mostrarAyuda();
        } else {
            const {Push} = await import(/* webpackChunkName: "mrlang/push" */ "../clases/push");
            await Push.run(this.root);
        }
    }

    protected mostrarAyuda(): void {
        console.log(`${Colors.colorize([Colors.FgCyan, Colors.Bright], "Descripción")}: Sube los cambios a la Base de Datos de traducción.`);
        console.log(`${Colors.colorize([Colors.FgCyan, Colors.Bright], "Uso")}:         ${Colors.colorize([Colors.FgBlue], "yarn mrlang")} ${Colors.colorize([Colors.FgGreen], "push")} ${Colors.colorize([Colors.FgYellow], "[opciones]")}`);
        console.log("");
        console.group();

        console.log(`${Colors.colorize([Colors.FgYellow], "[opciones]")}:`);
        console.group();
        console.log(`${Colors.colorize([Colors.FgMagenta], "Opciones disponibles:")}`);
        console.group();
        console.log(`${Colors.colorize([Colors.FgBlue], "-h")} ${Colors.colorize([Colors.FgYellow], "--help")}:               Muestra la ayuda`);
        console.groupEnd();
        console.groupEnd();
        console.log("");

        console.groupEnd();
    }
}
