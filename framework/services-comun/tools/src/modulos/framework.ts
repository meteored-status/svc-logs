import {IModulo, IModuloConfig, Modulo} from "../modulo";
import {Colors} from "../clases/colors";
import {Framework} from "../clases/framework";

export interface IFrameworkConfig extends IModuloConfig {
    options: IModuloConfig["options"] & {
        add: { type: "string", multiple: true, };
        remove: { type: "string", multiple: true, };
    };
}

export interface IFramework extends IModulo {
    add?: string[];
    remove?: string[];
}

export class ModuloFramework<T extends IFrameworkConfig> extends Modulo<T> {
    /* STATIC */
    protected static override OPTIONS: IFrameworkConfig = {
        ...Modulo.OPTIONS,
        options: {
            ...Modulo.OPTIONS.options,
            add: { type: "string", multiple: true, },
            remove: { type: "string", multiple: true, },
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

    protected async parseParams(config: IFramework): Promise<void> {
        if (config.help) {
            this.mostrarAyuda();
        } else {
            if (config.add!=undefined) {
                await Framework.add(this.root, config.add);
            }
            if (config.remove!=undefined) {
                await Framework.remove(this.root, config.remove);
            }
        }
    }

    protected mostrarAyuda(): void {
        console.log(`${Colors.colorize([Colors.FgCyan, Colors.Bright], "Descripción")}: Operaciones sobre los frameworks`);
        console.log(`${Colors.colorize([Colors.FgCyan, Colors.Bright], "Uso")}:         ${Colors.colorize([Colors.FgBlue], "yarn mrpack")} ${Colors.colorize([Colors.FgGreen], "deploy")} ${Colors.colorize([Colors.FgYellow], "[opciones]")}`);
        console.log("");
        console.group();

        console.log(`${Colors.colorize([Colors.FgYellow], "[opciones]")}:`);
        console.group();
        console.log(`${Colors.colorize([Colors.FgMagenta], "Opciones disponibles:")}`);
        console.group();
        console.log(`${Colors.colorize([Colors.FgYellow], "--add")}=${Colors.colorize([Colors.FgGreen], "<framework>")}:    Añade un framework`);
        console.log(`                      ${Colors.colorize([Colors.FgWhite], "Se puede especificar múltiples veces")}`);
        console.log(`${Colors.colorize([Colors.FgYellow], "--remove")}=${Colors.colorize([Colors.FgGreen], "<framework>")}: Elimina un framework`);
        console.log(`                      ${Colors.colorize([Colors.FgWhite], "Se puede especificar múltiples veces")}`);
        console.groupEnd();
        console.groupEnd();
        console.log("");

        console.groupEnd();
    }
}
