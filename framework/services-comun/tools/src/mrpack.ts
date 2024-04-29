import {Colors} from "./clases/colors";
import {IModulo, IModuloConfig, Modulo} from "./modulo";
import {ModuloDevel} from "./modulos/devel";
import {ModuloDeploy} from "./modulos/deploy";
import {ModuloInit} from "./modulos/init";
import {ModuloUpdate} from "./modulos/update";
import {ModuloUpload} from "./modulos/upload";
import {ModuloFramework} from "./modulos/framework";

export interface IMRPackConfig extends IModuloConfig {
    options: IModuloConfig["options"];/* & {
    };*/
}

export interface IMRPack extends IModulo {

}

export class MRPack<T extends IMRPackConfig> extends Modulo<T> {
    /* STATIC */
    protected static override OPTIONS: IMRPackConfig = {
        ...Modulo.OPTIONS,
        options: {
            ...Modulo.OPTIONS.options,
        },
        strict: false,
    };

    private static MODULOS = [
        "devel",
        "deploy",
        "framework",
        "init",
        "update",
        "upload",
    ];

    public static override run(): void {
        super.run(new this(this.OPTIONS));
    }

    /* INSTANCE */
    protected constructor(config: T) {
        super(config);
    }

    protected override async parsePositionals(positionals: string[]): Promise<void> {
        if (positionals.length!=1 || !MRPack.MODULOS.includes(positionals[0])) {
            this.mostrarAyuda();

            return Promise.reject();
        }
    }

    protected async parseParams(config: IMRPack, positionals: string[]): Promise<void> {
        switch (positionals[0]) {
            case "devel":
                ModuloDevel.run();
                break;
            case "deploy":
                ModuloDeploy.run();
                break;
            case "framework":
                ModuloFramework.run();
                break;
            case "init":
                ModuloInit.run();
                break;
            case "update":
                ModuloUpdate.run();
                break;
            case "upload":
                ModuloUpload.run();
                break;
            default:
                this.mostrarAyuda();

                return Promise.reject();
        }
    }

    protected mostrarAyuda(): void {
        console.log(`${Colors.colorize([Colors.FgCyan, Colors.Bright], "Uso")}: ${Colors.colorize([Colors.FgBlue], "yarn mrpack")} ${Colors.colorize([Colors.FgGreen], "<modulo>")} ${Colors.colorize([Colors.FgYellow], "[opciones]")}`);
        console.log("");
        console.group();

            console.log(`${Colors.colorize([Colors.FgGreen], "<modulo>")}:`);
            console.group();
                console.log(`Indica el módulo a ejecutar.`);
                console.log(`${Colors.colorize([Colors.FgMagenta], "Módulos disponibles:")}`);
                console.group();
                    console.log(`${Colors.colorize([Colors.FgBlue], "devel")}:     Inicia el entorno de desarrollo`);
                    console.log(`${Colors.colorize([Colors.FgBlue], "deploy")}:    Compila el proyecto en modo producción`);
                    console.log(`${Colors.colorize([Colors.FgBlue], "framework")}: Operaciones sobre los frameworks`);
                    console.log(`${Colors.colorize([Colors.FgBlue], "init")}:      Inicializa la configuración del proyecto`);
                    console.log(`${Colors.colorize([Colors.FgBlue], "update")}:    Actualiza las librerías`);
                    console.log(`${Colors.colorize([Colors.FgBlue], "upload")}:    Sube los frameworks para compartirlos entre proyectos`);
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
