import {IModulo, IModuloConfig, Modulo} from "../modulo";
import {Colors} from "../clases/colors";
import {Framework} from "../clases/framework";

export interface IUploadConfig extends IModuloConfig {
    options: IModuloConfig["options"] & {

    };
}

export interface IUpload extends IModulo {

}

export class ModuloUpload<T extends IUploadConfig> extends Modulo<T> {
    /* STATIC */
    protected static override OPTIONS: IUploadConfig = {
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

    protected async parseParams(config: IUpload): Promise<void> {
        if (config.help) {
            this.mostrarAyuda();
        } else {
            await Framework.push(this.root);
        }
    }

    protected mostrarAyuda(): void {
        console.log(`${Colors.colorize([Colors.FgCyan, Colors.Bright], "Descripción")}: Sube los frameworks para compartirlos entre proyectos`);
        console.log(`${Colors.colorize([Colors.FgCyan, Colors.Bright], "Uso")}:         ${Colors.colorize([Colors.FgBlue], "yarn mrpack")} ${Colors.colorize([Colors.FgGreen], "upload")} ${Colors.colorize([Colors.FgYellow], "[opciones]")}`);
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
