/**
 * Editor: Bixus
 * Fecha: Mon, 07 Sep 2026 13:12:27 GMT
 * Hash: b268ca634512a54f35f04fcc76b9edfc
 * Versión: 2026.9.7+1-bixus
 * Anterior: 2026.7.17+1-josantoniojimnez
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

import {type IModulo, type IModuloConfig, Modulo} from "@mr/core-cli/modulo";
import {Colors} from "@mr/core-cli/colors";
import type {IConfigEjecucion} from "../clases/devel";
import {run} from "../clases/devel";

export interface IDevelConfig extends IModuloConfig {
    options: IModuloConfig["options"] & {
        compilar: { type: "boolean", short: "c", default: false, },
        ejecutar: { type: "boolean", short: "e", default: false, },
        forzar:   { type: "boolean", short: "f", default: false, },
        watch:    { type: "boolean", short: "w", default: false, },
    };
}

export interface IDevel extends IModulo, IConfigEjecucion {
}

/**
 * Módulo CLI `mrpack devel`: inicia la compilación y/o ejecución de los workspaces en modo desarrollo.
 */
export class ModuloDevel<T extends IDevelConfig> extends Modulo<T> {
    /* STATIC */
    protected static override OPTIONS: IDevelConfig = {
        ...Modulo.OPTIONS,
        options: {
            ...Modulo.OPTIONS.options,
            compilar: { type: "boolean", short: "c", default: false, },
            ejecutar: { type: "boolean", short: "e", default: false, },
            forzar:   { type: "boolean", short: "f", default: false, },
            watch:    { type: "boolean", short: "w", default: false, },
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

    /**
     * Arranca el entorno de desarrollo o muestra la ayuda según los flags.
     *
     * Requiere al menos `-c` o `-e`; sin ninguno de los dos muestra la ayuda.
     *
     * @param config - Opciones del módulo (`help`, `compilar`, `ejecutar`, `forzar`, `watch`).
     */
    protected async parseParams(config: IDevel): Promise<void> {
        if (config.help || (!config.compilar && !config.ejecutar)) {
            this.mostrarAyuda();
        } else {
            run(this.root, config);
        }
    }

    protected mostrarAyuda(): void {
        console.log(`${Colors.colorize([Colors.FgCyan, Colors.Bright], "Descripción")}: Inicia la compilación/ejecución de los workspaces del proyecto`);
        console.log(`${Colors.colorize([Colors.FgCyan, Colors.Bright], "Uso")}:         ${Colors.colorize([Colors.FgBlue], "yarn mrpack")} ${Colors.colorize([Colors.FgGreen], "devel")} ${Colors.colorize([Colors.FgYellow], "[opciones] [adicional]")}`);
        console.log("");
        console.group();

        console.log(`${Colors.colorize([Colors.FgYellow], "[opciones]")}:`);
        console.group();
        console.log(`${Colors.colorize([Colors.FgMagenta], "Opciones disponibles:")}`);
        console.group();
        console.log(`${Colors.colorize([Colors.FgBlue], "-c")} ${Colors.colorize([Colors.FgYellow], "--compilar")}: Compila los workspaces habilitados`);
        console.log(`${Colors.colorize([Colors.FgBlue], "-e")} ${Colors.colorize([Colors.FgYellow], "--ejecutar")}: Ejecuta los workspaces habilitados`);
        console.groupEnd();
        console.groupEnd();
        console.log("");

        console.log(`${Colors.colorize([Colors.FgYellow], "[adicional]")}:`);
        console.group();
        console.log(`${Colors.colorize([Colors.FgMagenta], "Opciones adicionales disponibles:")}`);
        console.group();
        console.log(`${Colors.colorize([Colors.FgBlue], "-f")} ${Colors.colorize([Colors.FgYellow], "--forzar")}:   Ejecuta los workspaces habilitados`);
        console.log(`${Colors.colorize([Colors.FgBlue], "-w")} ${Colors.colorize([Colors.FgYellow], "--watch")}:    Activa el modo watch; sin esta opción los compiladores compilan una vez y el proceso termina`);
        console.groupEnd();
        console.groupEnd();
        console.log("");

        console.groupEnd();
    }
}
