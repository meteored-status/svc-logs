/**
 * Editor: José Antonio Jiménez
 * Fecha: Wed, 27 May 2026 09:00:52 GMT
 * Hash: e52c13dea36122d3a439214e3ac71e9e
 * Versión: 2026.5.27+1-josantoniojimnez
 * Anterior: 2026.5.21+4-josantoniojimnez
 */

import {type IModulo, type IModuloConfig, Modulo} from "../modulo";
import {Colors} from "../clases/colors";
import {actualizarTodo, enviarTodo, gestionar, resetearTodo} from "../clases/framework";

export interface IFrameworkConfig extends IModuloConfig {
    options: IModuloConfig["options"] & {
        update: { type: "boolean"; short: "u"; default: false };
        reset:  { type: "boolean"; short: "r"; default: false };
        send:   { type: "boolean"; short: "s"; default: false };
        yes:    { type: "boolean"; short: "y"; default: false };
    };
}

export interface IFramework extends IModulo {
    update: boolean;
    reset:  boolean;
    send:   boolean;
    yes:    boolean;
}

/**
 * Módulo CLI `mrpack framework`: gestión interactiva de frameworks (actualizar, resetear, enviar).
 */
export class ModuloFramework<T extends IFrameworkConfig> extends Modulo<T> {
    /* STATIC */
    protected static override OPTIONS: IFrameworkConfig = {
        ...Modulo.OPTIONS,
        options: {
            ...Modulo.OPTIONS.options,
            update: { type: "boolean", short: "u", default: false },
            reset:  { type: "boolean", short: "r", default: false },
            send:   { type: "boolean", short: "s", default: false },
            yes:    { type: "boolean", short: "y", default: false },
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
     * Delega en la operación de framework indicada (`update`, `reset`, `send`) o abre el gestor interactivo.
     *
     * @param config - Opciones del módulo (`help`, `update`, `reset`, `send`, `yes`).
     */
    protected async parseParams(config: IFramework): Promise<void> {
        if (config.help) {
            this.mostrarAyuda();
        } else if (config.update) {
            await actualizarTodo(this.root, {forzar: config.yes, reiniciar: false});
        } else if (config.reset) {
            await resetearTodo(this.root, {forzar: config.yes, reiniciar: false});
        } else if (config.send) {
            await enviarTodo(this.root, {forzar: config.yes, reiniciar: false});
        } else {
            await gestionar(this.root, {reiniciar: false});
        }
    }

    protected mostrarAyuda(): void {
        console.log(`${Colors.colorize([Colors.FgCyan, Colors.Bright], "Descripción")}: Gestión interactiva de frameworks`);
        console.log(`${Colors.colorize([Colors.FgCyan, Colors.Bright], "Uso")}:         ${Colors.colorize([Colors.FgBlue], "yarn mrpack")} ${Colors.colorize([Colors.FgGreen], "framework")} ${Colors.colorize([Colors.FgYellow], "[opciones]")}`);
        console.log("");
        console.log("Sin opciones abre el gestor interactivo con la tabla completa de paquetes.");
        console.log("");
        console.log(`  ${Colors.colorize([Colors.FgYellow], "-u")}, ${Colors.colorize([Colors.FgYellow], "--update")}   Muestra tabla de paquetes con update disponible (preseleccionados) para elegir cuáles actualizar`);
        console.log(`  ${Colors.colorize([Colors.FgYellow], "-r")}, ${Colors.colorize([Colors.FgYellow], "--reset")}    Muestra tabla de paquetes instalados (preseleccionados) para elegir cuáles resetear`);
        console.log(`  ${Colors.colorize([Colors.FgYellow], "-s")}, ${Colors.colorize([Colors.FgYellow], "--send")}     Muestra tabla de paquetes con cambios locales (preseleccionados) para elegir cuáles enviar`);
        console.log(`  ${Colors.colorize([Colors.FgYellow], "-y")}, ${Colors.colorize([Colors.FgYellow], "--yes")}      Junto con -u/-r/-s, omite la tabla y aplica la acción sobre todos los paquetes sin interacción`);
        console.log(`  ${Colors.colorize([Colors.FgYellow], "-h")}, ${Colors.colorize([Colors.FgYellow], "--help")}     Muestra esta ayuda`);
        console.log("");
    }
}
