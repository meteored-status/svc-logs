import {type IModulo, type IModuloConfig, Modulo} from "../modulo";
import {Colors} from "../clases/colors";

export interface IFrameworkConfig extends IModuloConfig {
    options: IModuloConfig["options"] & {
        add: { type: "string", multiple: true, };
        list: { type: "string", default: undefined, };
        remove: { type: "string", multiple: true, };
        repository: { type: "string", default: undefined, };
        reset: { type: "boolean", default: false, };
        update: { type: "boolean", default: true, };
    };
}

export interface IFramework extends IModulo {
    add?: string[];
    list?: string;
    remove?: string[];
    repository?: string;
    reset: boolean;
    update: boolean;
}

export class ModuloFramework<T extends IFrameworkConfig> extends Modulo<T> {
    /* STATIC */
    protected static override OPTIONS: IFrameworkConfig = {
        ...Modulo.OPTIONS,
        options: {
            ...Modulo.OPTIONS.options,
            add: { type: "string", multiple: true, },
            list: { type: "string", default: undefined, },
            remove: { type: "string", multiple: true, },
            repository: { type: "string", default: undefined, },
            reset: { type: "boolean", default: false, },
            update: { type: "boolean", default: true, },
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
            const {Framework} = await import(/* webpackChunkName: "mrpack/framework" */ "../clases/framework");
            if (config.add!=undefined) {
                await Framework.add(this.root, config.add);
            }
            if (config.remove!=undefined) {
                await Framework.remove(this.root, config.remove);
            }
            if (config.reset) {
                await Framework.reset(this.root);
            } else if (config.list!=undefined) {
                await Framework.list(config.list, config.repository);
            } else if (config.update) {
                await Framework.pull(this.root, true);
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
        console.log(`${Colors.colorize([Colors.FgYellow], "--add")}=${Colors.colorize([Colors.FgGreen], "<framework>")}:          Añade un framework`);
        console.log(`                            ${Colors.colorize([Colors.FgWhite], "Se puede especificar múltiples veces")}`);
        console.log(`${Colors.colorize([Colors.FgYellow], "--list")}=${Colors.colorize([Colors.FgGreen], "<tipo>")}:              Lista los frameworks disponibles para instalar`);
        console.log(`                            ${Colors.colorize([Colors.FgWhite], "Se puede especificar múltiples veces")}`);
        console.log(`${Colors.colorize([Colors.FgYellow], "--remove")}=${Colors.colorize([Colors.FgGreen], "<framework>")}:       Elimina un framework`);
        console.log(`                            ${Colors.colorize([Colors.FgWhite], "Se puede especificar múltiples veces")}`);
        console.log(`${Colors.colorize([Colors.FgYellow], "--repository")}=${Colors.colorize([Colors.FgGreen], "<repositorio>")}: Repositorio desde el que listar/añadir frameworks`);
        console.log(`                            ${Colors.colorize([Colors.FgWhite], "Se puede especificar múltiples veces")}`);
        console.log(`${Colors.colorize([Colors.FgYellow], "--reset")}:                    Resetea los frameworks (implica --update)`);
        console.log(`${Colors.colorize([Colors.FgYellow], "--update")}:                   Actualiza los frameworks`);
        console.groupEnd();
        console.groupEnd();
        console.log("");

        console.groupEnd();
    }
}
