import {IModulo, IModuloConfig, Modulo} from "../modulo";
import {Colors} from "../clases/colors";
import {Devel, IConfigEjecucion} from "../clases/devel";

export interface IDevelConfig extends IModuloConfig {
    options: IModuloConfig["options"] & {
        compilar: { type: "boolean", short: "c", default: false, },
        ejecutar: { type: "boolean", short: "e", default: false, },
        forzar:   { type: "boolean", short: "f", default: false, },
    };
}

export interface IDevel extends IModulo, IConfigEjecucion {
}

export class ModuloDevel<T extends IDevelConfig> extends Modulo<T> {
    /* STATIC */
    protected static override OPTIONS: IDevelConfig = {
        ...Modulo.OPTIONS,
        options: {
            ...Modulo.OPTIONS.options,
            compilar: { type: "boolean", short: "c", default: false, },
            ejecutar: { type: "boolean", short: "e", default: false, },
            forzar:   { type: "boolean", short: "f", default: false, },
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

    protected async parseParams(config: IDevel): Promise<void> {
        if (config.help) {
            this.mostrarAyuda();
        } else {
            await Devel.run(this.root, config);
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
        console.groupEnd();
        console.groupEnd();
        console.log("");

        console.groupEnd();
    }
}
