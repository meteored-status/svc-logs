/**
 * Editor: José Antonio Jiménez
 * Fecha: Wed, 27 May 2026 09:00:52 GMT
 * Hash: 982ac47a6fffe64da6b2ac995cb93671
 * Versión: 2026.5.27+1-josantoniojimnez
 */

import {readJSON} from "services-comun/modules/utiles/fs";
import {Colors} from "./clases/colors";
import {IPackageJson} from "./clases/packagejson";
import {type IModulo, type IModuloConfig, Modulo} from "./modulo";
import {ModuloDevel} from "./modulos/devel";
import {ModuloDeploy} from "./modulos/deploy";
import {ModuloInit} from "./modulos/init";
import {ModuloUpdate} from "./modulos/update";
import {ModuloFramework} from "./modulos/framework";
import {ModuloAutoDoc} from "./modulos/auto-doc";

export interface IMRPackConfig extends IModuloConfig {
    options: IModuloConfig["options"];/* & {
    };*/
}

export interface IMRPack extends IModulo {

}

/**
 * Punto de entrada del CLI `mrpack`.
 * Muestra la versión y delega en el submódulo indicado como primer positional.
 */
export class MRPack<T extends IMRPackConfig> extends Modulo<T> {
    /* STATIC */
    protected static override OPTIONS: IMRPackConfig = {
        ...Modulo.OPTIONS,
        options: {
            ...Modulo.OPTIONS.options,
        },
        strict: false,
    };

    private static readonly MODULOS = [
        "autodoc",
        "devel",
        "deploy",
        "framework",
        "init",
        "update",
    ] as const;

    public static override run(): void {
        super.run(new this(this.OPTIONS));
    }

    /* INSTANCE */
    protected constructor(config: T) {
        super(config);
    }

    /**
     * Muestra la versión del CLI y delega en el ciclo de parseo de la clase base.
     *
     */
    protected override async run(): Promise<void> {
        const {version} = await readJSON<IPackageJson>(`${this.root}/@mr/cli/package.json`);
        const [v, autor] = version!.split("-");
        const [mayor, release] = v.split("+");
        const partes: string[] = [];
        partes.push(Colors.colorize([Colors.FgWhite, Colors.Underscore], "MRPack"));
        partes.push(" ")
        partes.push(Colors.colorize([Colors.FgGreen, Colors.Bright], mayor));
        partes.push(Colors.colorize([Colors.FgWhite], "+"));
        partes.push(Colors.colorize([Colors.FgRed, Colors.Bright], release));
        if (autor!=undefined) {
            partes.push(" ");
            partes.push(Colors.colorize([Colors.FgWhite], "("));
            partes.push(Colors.colorize([Colors.FgMagenta], autor));
            partes.push(Colors.colorize([Colors.FgWhite], ")"));
        }
        console.log(partes.join(""));
        console.log("");

        await super.run();
    }

    /**
     * Valida que se haya indicado exactamente un submódulo válido; muestra la ayuda si no.
     *
     * @param positionals - Argumentos posicionales (se espera uno: el nombre del submódulo).
     */
    protected override async parsePositionals(positionals: string[]): Promise<void> {
        if (positionals.length!=1 || !(MRPack.MODULOS as readonly string[]).includes(positionals[0])) {
            this.mostrarAyuda();

            return Promise.reject();
        }
    }

    /**
     * Delega la ejecución en el submódulo indicado como primer positional.
     *
     * @param config      - Opciones globales del CLI (actualmente solo `help`).
     * @param positionals - Lista de argumentos posicionales; el primero es el nombre del submódulo.
     */
    protected async parseParams(config: IMRPack, positionals: string[]): Promise<void> {
        switch (positionals[0]) {
            case "autodoc":
                ModuloAutoDoc.run();
                break;
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
                    console.log(`${Colors.colorize([Colors.FgBlue], "autodoc")}:   Genera la documentación automática del proyecto`);
                    console.log(`${Colors.colorize([Colors.FgBlue], "devel")}:     Inicia el entorno de desarrollo`);
                    console.log(`${Colors.colorize([Colors.FgBlue], "deploy")}:    Compila el proyecto en modo producción`);
                    console.log(`${Colors.colorize([Colors.FgBlue], "framework")}: Operaciones sobre los frameworks`);
                    console.log(`${Colors.colorize([Colors.FgBlue], "init")}:      Inicializa la configuración del proyecto`);
                    console.log(`${Colors.colorize([Colors.FgBlue], "update")}:    Actualiza las librerías`);
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
