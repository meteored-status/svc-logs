import {Colors} from "../mrpack/clases/colors";
import type {IModulo, IModuloConfig} from "../mrpack/modulo";
import {Modulo} from "./modulo";
import {ModuloFRemote} from "./modulos/fremote";
import {ModuloGenerate} from "./modulos/generate";
import {ModuloInit} from "./modulos/init";
import {ModuloPull} from "./modulos/pull";
import {ModuloPush} from "./modulos/push";

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
        "fremote",
        "generate",
        "init",
        "pull",
        "push",
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
            case "fremote":
                ModuloFRemote.run();
                break;
            case "generate":
                ModuloGenerate.run();
                break;
            case "init":
                ModuloInit.run();
                break;
            case "pull":
                ModuloPull.run();
                break;
            case "push":
                ModuloPush.run();
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
                    console.log(`${Colors.colorize([Colors.FgBlue], "fremote")}:  Corrige las versiones de los módulos remotos`);
                    console.log(`${Colors.colorize([Colors.FgBlue], "generate")}: Regenera las clases TS a partir de los JSON`);
                    console.log(`${Colors.colorize([Colors.FgBlue], "init")}:     Inicializa el proyecto de traducciones`);
                    console.log(`${Colors.colorize([Colors.FgBlue], "pull")}:     Compila el proyecto en modo producción`);
                    console.log(`${Colors.colorize([Colors.FgBlue], "push")}:     Sube los frameworks para compartirlos entre proyectos`);
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
