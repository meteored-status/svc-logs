import {Colors} from "services-comun/tools/src/mrpack/clases/colors";
import type {IModulo, IModuloConfig} from "services-comun/tools/src/mrpack/modulo";

import {Modulo} from "../modulo";

export interface IGenerateConfig extends IModuloConfig {
    options: IModuloConfig["options"] & {
        watch: { type: "boolean", default: false, };
    };
}

export interface IGenerate extends IModulo {
    watch: boolean;
}

export class ModuloGenerate<T extends IGenerateConfig> extends Modulo<T> {
    /* STATIC */
    protected static override OPTIONS: IGenerateConfig = {
        ...Modulo.OPTIONS,
        options: {
            ...Modulo.OPTIONS.options,
            watch: { type: "boolean", default: false, },
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

    protected async parseParams(config: IGenerate): Promise<void> {
        if (config.help) {
            this.mostrarAyuda();
        } else {
            const {Generate} = await import(/* webpackChunkName: "mrlang/generate" */ "../clases/generate");
            await Generate.run(this.root, config.watch);
        }
    }

    protected mostrarAyuda(): void {
        console.log(`${Colors.colorize([Colors.FgCyan, Colors.Bright], "Descripción")}: Genera las clases de traducción a partir de los JSON.`);
        console.log(`${Colors.colorize([Colors.FgCyan, Colors.Bright], "Uso")}:         ${Colors.colorize([Colors.FgBlue], "yarn mrlang")} ${Colors.colorize([Colors.FgGreen], "pull")} ${Colors.colorize([Colors.FgYellow], "[opciones]")}`);
        console.log("");
        console.group();

        console.log(`${Colors.colorize([Colors.FgYellow], "[opciones]")}:`);
        console.group();
        console.log(`${Colors.colorize([Colors.FgMagenta], "Opciones disponibles:")}`);
        console.group();
        console.log(`${Colors.colorize([Colors.FgBlue], "  ")} ${Colors.colorize([Colors.FgYellow], "--watch")}:                 Observa los cambios en los JSON y regenera automáticamente`);
        console.log(`${Colors.colorize([Colors.FgBlue], "-h")} ${Colors.colorize([Colors.FgYellow], "--help")}:                  Muestra la ayuda`);
        console.groupEnd();
        console.groupEnd();
        console.log("");

        console.groupEnd();
    }
}
