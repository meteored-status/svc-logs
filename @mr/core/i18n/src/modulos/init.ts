/**
 * Editor: Bixus
 * Fecha: Mon, 07 Sep 2026 13:12:27 GMT
 * Hash: 33c15da509cfa2e38c4ef0f868b7f1fc
 * Versión: 2026.9.7+1-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

import {Colors} from "@mr/core-cli/colors";
import {type IModulo, type IModuloConfig, Modulo} from "@mr/core-cli/modulo";

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
