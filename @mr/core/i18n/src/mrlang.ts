/**
 * Editor: Bixus
 * Fecha: Mon, 07 Sep 2026 13:12:27 GMT
 * Hash: 807ef55cd131af9c99b9fa474450a02a
 * Versión: 2026.9.7+1-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

import {Colors} from "@mr/core-cli/colors";
import {type IModulo, type IModuloConfig, Modulo} from "@mr/core-cli/modulo";
import {ModuloGenerate} from "./modulos/generate";
import {ModuloInit} from "./modulos/init";

export interface IMRLangConfig extends IModuloConfig {
    options: IModuloConfig["options"] & {
        version: { type: "string", short: "v", default: "1", },
    };
}

export interface IMRLang extends IModulo {

}

export class MRLang<T extends IMRLangConfig> extends Modulo<T> {
    /* STATIC */
    protected static override OPTIONS: IMRLangConfig = {
        ...Modulo.OPTIONS,
        options: {
            ...Modulo.OPTIONS.options,
            version: { type: "string", short: "v", default: "1", },
        },
        strict: false,
    };

    private static MODULOS = [
        "generate",
        "init",
    ];

    public static override run(): void {
        super.run(new this(this.OPTIONS));
    }

    /* INSTANCE */
    protected constructor(config: T) {
        super(config);
    }

    protected override async parsePositionals(positionals: string[]): Promise<void> {
        if (positionals.length!=1 || !MRLang.MODULOS.includes(positionals[0])) {
            this.mostrarAyuda();

            return Promise.reject();
        }
    }

    protected async parseParams(config: IMRLang, positionals: string[]): Promise<void> {
        switch (positionals[0]) {
            case "generate":
                ModuloGenerate.run();
                break;
            case "init":
                ModuloInit.run();
                break;
            default:
                this.mostrarAyuda();

                return Promise.reject();
        }
    }

    protected mostrarAyuda(): void {
        console.log(`${Colors.colorize([Colors.FgCyan, Colors.Bright], "Uso")}: ${Colors.colorize([Colors.FgBlue], "yarn mrlang")} ${Colors.colorize([Colors.FgGreen], "<modulo>")} ${Colors.colorize([Colors.FgYellow], "[opciones]")}`);
        console.log("");
        console.group();

            console.log(`${Colors.colorize([Colors.FgGreen], "<modulo>")}:`);
            console.group();
                console.log(`Indica el módulo a ejecutar.`);
                console.log(`${Colors.colorize([Colors.FgMagenta], "Módulos disponibles:")}`);
                console.group();
                    console.log(`${Colors.colorize([Colors.FgBlue], "generate")}: Regenera las clases TS a partir de los JSON`);
                    console.log(`${Colors.colorize([Colors.FgBlue], "init")}:     Inicializa el proyecto de traducciones`);
                console.groupEnd();
                console.log(`${Colors.colorize([Colors.FgRed], "Solo puede indicarse uno")}`);
            console.groupEnd();
            console.log("");

            console.log(`${Colors.colorize([Colors.FgYellow], "[opciones]")}:`);
            console.group();
                console.log(`Permiten customizar el módulo.`);
                console.log(`${Colors.colorize([Colors.FgMagenta], "Opciones disponibles:")}`);
                console.group();
                    console.log(`${Colors.colorize([Colors.FgBlue], "-h")} ${Colors.colorize([Colors.FgYellow], "--help")}:  Muestra la ayuda`);
                    console.log(`            ${Colors.colorize([Colors.FgWhite], "Puede especificar esta opción en cualquier momento para mostrar la ayuda del módulo")}`);
                console.groupEnd();
            console.groupEnd();
            console.log("");

        console.groupEnd();
    }
}
