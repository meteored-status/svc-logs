/**
 * Editor: Bixus
 * Fecha: Mon, 07 Sep 2026 13:12:27 GMT
 * Hash: 4b7c4b7f7999fab79985a50be1f1cb20
 * Versión: 2026.9.7+1-bixus
 * Anterior: 2026.5.27+1-josantoniojimnez
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

import {type IModulo, type IModuloConfig, Modulo} from "@mr/core-cli/modulo";
import {Colors} from "@mr/core-cli/colors";
import {init} from "../clases/update";

export interface IUpdateConfig extends IModuloConfig {/**/}
export interface IUpdate extends IModulo {/**/}

/**
 * Módulo CLI `mrpack update`: inicializa la configuración y actualiza las librerías del monorepo.
 */
export class ModuloUpdate<T extends IUpdateConfig> extends Modulo<T> {
    /* STATIC */
    protected static override OPTIONS: IUpdateConfig = {
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

    /**
     * Ejecuta la actualización de librerías o muestra la ayuda.
     *
     * @param config - Opciones del módulo (`help`).
     */
    protected async parseParams(config: IUpdate): Promise<void> {
        if (config.help) {
            this.mostrarAyuda();
        } else {
            await init(this.root);
        }
    }

    protected mostrarAyuda(): void {
        console.log(`${Colors.colorize([Colors.FgCyan, Colors.Bright], "Descripción")}: Inicializa la configuración del proyecto y actualiza las librerías`);
        console.log(`${Colors.colorize([Colors.FgCyan, Colors.Bright], "Uso")}:         ${Colors.colorize([Colors.FgBlue], "yarn mrpack")} ${Colors.colorize([Colors.FgGreen], "update")} ${Colors.colorize([Colors.FgYellow], "[opciones]")}`);
        console.log("");
        console.group();

        console.log(`${Colors.colorize([Colors.FgYellow], "[opciones]")}:`);
        console.group();
        console.log(`${Colors.colorize([Colors.FgMagenta], "Opciones disponibles:")}`);
        console.group();
        console.log(`${Colors.colorize([Colors.FgBlue], "-h")} ${Colors.colorize([Colors.FgYellow], "--help")}:  Muestra la ayuda`);
        console.groupEnd();
        console.groupEnd();
        console.log("");

        console.groupEnd();
    }
}
