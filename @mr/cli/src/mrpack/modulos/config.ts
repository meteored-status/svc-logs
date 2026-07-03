/**
 * Editor: José Antonio Jiménez
 * Fecha: Thu, 25 Jun 2026 11:42:00 GMT
 * Hash: 86e9c5dfb6d03a67f24e3cdc816d2fab
 * Versión: 2026.6.25+10-josantoniojimnez
 */

import {type IModulo, type IModuloConfig, Modulo} from "../modulo";
import {Colors} from "../clases/colors";
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

