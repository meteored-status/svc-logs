/**
 * Editor: José Antonio Jiménez
 * Fecha: Fri, 15 May 2026 12:09:04 GMT
 * Hash: 12f04e84451f8c07407d4e71ee98ea88
 */

import {Colors} from "../../mrpack/clases/colors";
import type {IModulo, IModuloConfig} from "../../mrpack/modulo";
import {Modulo} from "../modulo";

export interface IInitConfig extends IModuloConfig {
    options: IModuloConfig["options"] & {
    };
}

export interface IInit extends IModulo {
}

export class ModuloInit<T extends IInitConfig> extends Modulo<T> {
    /* STATIC */
    protected static override OPTIONS: IInitConfig = {
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

    protected async parseParams(config: IInit): Promise<void> {
        if (config.help) {
            this.mostrarAyuda();
        } else {
            const {Init} = await import(/* webpackChunkName: "mrlang/init" */ "../clases/init");
            await Init.run(this.root);
        }
    }

    protected mostrarAyuda(): void {
        console.log(`${Colors.colorize([Colors.FgCyan, Colors.Bright], "Descripción")}: Inicializa el proyecto de traducciones.`);
        console.log(`${Colors.colorize([Colors.FgCyan, Colors.Bright], "Uso")}:         ${Colors.colorize([Colors.FgBlue], "yarn mrlang")} ${Colors.colorize([Colors.FgGreen], "init")} ${Colors.colorize([Colors.FgYellow], "[opciones]")}`);
        console.log("");
        console.group();

        console.log(`${Colors.colorize([Colors.FgYellow], "[opciones]")}:`);
        console.group();
        console.log(`${Colors.colorize([Colors.FgMagenta], "Opciones disponibles:")}`);
        console.group();
        console.log(`${Colors.colorize([Colors.FgBlue], "-h")} ${Colors.colorize([Colors.FgYellow], "--help")}:                  Muestra la ayuda`);
        console.groupEnd();
        console.groupEnd();
        console.log("");

        console.groupEnd();
    }
}
