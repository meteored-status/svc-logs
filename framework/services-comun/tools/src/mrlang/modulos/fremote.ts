import {Colors} from "services-comun/tools/src/mrpack/clases/colors";
import type {IModulo, IModuloConfig} from "services-comun/tools/src/mrpack/modulo";

import {Modulo} from "../modulo";

export interface IFRemoteConfig extends IModuloConfig {
    options: IModuloConfig["options"] & {
        modulo: { type: "string", short: "m", multiple: true, };
    };
}

export interface IFRemote extends IModulo {
    modulo?: string[];
}

export class ModuloFRemote<T extends IFRemoteConfig> extends Modulo<T> {
    /* STATIC */
    protected static override OPTIONS: IFRemoteConfig = {
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

    protected async parseParams(config: IFRemote): Promise<void> {
        if (config.help) {
            this.mostrarAyuda();
        } else {
            const {FixRemote} = await import(/* webpackChunkName: "mrlang/fremote" */ "../clases/fremote");
            await FixRemote.run(this.root, config.modulo);
        }
    }

    protected mostrarAyuda(): void {
        console.log(`${Colors.colorize([Colors.FgCyan, Colors.Bright], "Descripción")}: Corrige los códigos HASH y versión de los módulos en MySQL.`);
        console.log(`${Colors.colorize([Colors.FgCyan, Colors.Bright], "Uso")}:         ${Colors.colorize([Colors.FgBlue], "yarn mrlang")} ${Colors.colorize([Colors.FgGreen], "pull")} ${Colors.colorize([Colors.FgYellow], "[opciones]")}`);
        console.log("");
        console.group();

        console.log(`${Colors.colorize([Colors.FgYellow], "[opciones]")}:`);
        console.group();
        console.log(`${Colors.colorize([Colors.FgMagenta], "Opciones disponibles:")}`);
        console.group();
        console.log(`${Colors.colorize([Colors.FgBlue], "-m")} ${Colors.colorize([Colors.FgYellow], "--modulo")}=${Colors.colorize([Colors.FgGreen], "<modulo>")}:    Indica el módulo a cargar`);
        console.log(`                         ${Colors.colorize([Colors.FgWhite], "Se puede especificar múltiples veces")}`);
        console.log(`${Colors.colorize([Colors.FgBlue], "-h")} ${Colors.colorize([Colors.FgYellow], "--help")}:               Muestra la ayuda`);
        console.groupEnd();
        console.groupEnd();
        console.log("");

        console.groupEnd();
    }
}
