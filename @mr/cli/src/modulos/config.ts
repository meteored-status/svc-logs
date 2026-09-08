/**
 * Editor: Bixus
 * Fecha: Mon, 07 Sep 2026 13:12:27 GMT
 * Hash: 301511243c58ff49432a0380968e4be0
 * Versión: 2026.9.7+1-bixus
 * Anterior: 2026.6.25+10-josantoniojimnez
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

import {type IModulo, type IModuloConfig, Modulo} from "@mr/core-cli/modulo";
import {Colors} from "@mr/core-cli/colors";
import {gestionar} from "../clases/config";

export interface IConfigModuloConfig extends IModuloConfig {/**/}
export interface IConfigModulo extends IModulo {/**/}

/**
 * Módulo CLI `mrpack config`: gestión interactiva de `config.workspaces.json`.
 */
export class ModuloConfig<T extends IConfigModuloConfig> extends Modulo<T> {
    /* STATIC */
    protected static override OPTIONS: IConfigModuloConfig = {
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
        super(config);
    }

    /**
     * Abre el gestor interactivo de configuración o muestra la ayuda.
     *
     * @param config - Opciones del módulo (`help`).
     */
    protected async parseParams(config: IConfigModulo): Promise<void> {
        if (config.help) {
            this.mostrarAyuda();
        } else {
            await gestionar(this.root);
        }
    }

    protected mostrarAyuda(): void {
        console.log(`${Colors.colorize([Colors.FgCyan, Colors.Bright], "Descripción")}: Gestión interactiva de config.workspaces.json`);
        console.log(`${Colors.colorize([Colors.FgCyan, Colors.Bright], "Uso")}:         ${Colors.colorize([Colors.FgBlue], "yarn mrpack")} ${Colors.colorize([Colors.FgGreen], "config")} ${Colors.colorize([Colors.FgYellow], "[opciones]")}`);
        console.log("");
        console.log("Sin opciones abre el menú interactivo de configuración del proyecto.");
        console.log("");
        console.log(`  ${Colors.colorize([Colors.FgYellow], "-h")}, ${Colors.colorize([Colors.FgYellow], "--help")}     Muestra esta ayuda`);
        console.log("");
    }
}

