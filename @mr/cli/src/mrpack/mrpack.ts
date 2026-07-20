/**
 * Editor: José Antonio Jiménez
 * Fecha: Tue, 14 Jul 2026 07:18:57 GMT
 * Hash: 89d061c7be12faf89e818bcddb8ff6c8
 * Versión: 2026.7.14+1-josantoniojimnez
 * Anterior: 2026.6.25+10-josantoniojimnez
 * Proyecto: https://github.com/meteored-status/svc-logs.git
 */

import {readJSON} from "../utiles/fs";
import {Colors} from "./clases/colors";
import type {IPackageJson} from "./clases/packagejson";
import {type IModulo, type IModuloConfig, Modulo} from "./modulo";
import {ModuloConfig} from "./modulos/config";
import {ModuloDevel} from "./modulos/devel";
import {ModuloDeploy} from "./modulos/deploy";
import {ModuloInit} from "./modulos/init";
import {ModuloUpdate} from "./modulos/update";
import {ModuloFramework} from "./modulos/framework";
import {ModuloAutoDoc} from "./modulos/auto-doc";

interface IModuloMeta {
    nombre: string;
    descripcion: string;
    run: () => void;
}

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

    private static readonly MODULOS: readonly IModuloMeta[] = [
        {nombre: "autodoc", descripcion: "Genera la documentación automática del proyecto", run: ()=>ModuloAutoDoc.run()},
        {nombre: "config", descripcion: "Gestiona la configuración del proyecto (config.workspaces.json)", run: ()=>ModuloConfig.run()},
        {nombre: "devel", descripcion: "Inicia el entorno de desarrollo", run: ()=>ModuloDevel.run()},
        {nombre: "deploy", descripcion: "Compila el proyecto en modo producción", run: ()=>ModuloDeploy.run()},
        {nombre: "framework", descripcion: "Operaciones sobre los frameworks", run: ()=>ModuloFramework.run()},
        {nombre: "init", descripcion: "Inicializa la configuración del proyecto", run: ()=>ModuloInit.run()},
        {nombre: "update", descripcion: "Actualiza las librerías", run: ()=>ModuloUpdate.run()},
    ];

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
        if (version===undefined) {
            throw new Error("No se ha encontrado la versión de @mr/cli en su package.json");
        }
        const [v, autor] = version.split("-");
        const [mayor, release] = v.split("+");
        const partes: string[] = [];
        partes.push(Colors.colorize([Colors.FgWhite, Colors.Underscore], "MRPack"));
        partes.push(" ");
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
        if (positionals.length!=1 || !MRPack.MODULOS.some(modulo=>modulo.nombre===positionals[0])) {
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
    protected async parseParams(_config: IMRPack, positionals: string[]): Promise<void> {
        MRPack.MODULOS.find(modulo=>modulo.nombre===positionals[0])?.run();
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
                    for (const modulo of MRPack.MODULOS) {
                        console.log(`${Colors.colorize([Colors.FgBlue], modulo.nombre.padEnd(9))}: ${modulo.descripcion}`);
                    }
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
