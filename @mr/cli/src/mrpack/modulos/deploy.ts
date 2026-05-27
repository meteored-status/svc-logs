/**
 * Editor: José Antonio Jiménez
 * Fecha: Wed, 27 May 2026 09:00:52 GMT
 * Hash: e681bfeafb62261502a8e93dba684122
 * Versión: 2026.5.27+1-josantoniojimnez
 */

import {type IModulo, type IModuloConfig, Modulo} from "../modulo";
import {Colors} from "../clases/colors";
import {run} from "../clases/deploy";

export interface IDeployConfig extends IModuloConfig {
    options: IModuloConfig["options"] & {
        env: { type: "string", },
    };
}

export interface IDeploy extends IModulo {
    env?: string;
}

/**
 * Módulo CLI `mrpack deploy`: compila el proyecto para producción o test.
 */
export class ModuloDeploy<T extends IDeployConfig> extends Modulo<T> {
    /* STATIC */
    protected static override OPTIONS: IDeployConfig = {
        ...Modulo.OPTIONS,
        options: {
            ...Modulo.OPTIONS.options,
            env: { type: "string", },
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
     * Lanza el proceso de compilación para el entorno indicado, o muestra la ayuda.
     *
     * @param config - Opciones del módulo (`help`, `env`).
     */
    protected async parseParams(config: IDeploy): Promise<void> {
        if (config.help || config.env==undefined || !["produccion", "test"].includes(config.env)) {
            this.mostrarAyuda();
        } else {
            run(this.root, config.env);
        }
    }

    protected mostrarAyuda(): void {
        console.log(`${Colors.colorize([Colors.FgCyan, Colors.Bright], "Descripción")}: Compila el proyecto para producción`);
        console.log(`${Colors.colorize([Colors.FgCyan, Colors.Bright], "Uso")}:         ${Colors.colorize([Colors.FgBlue], "yarn mrpack")} ${Colors.colorize([Colors.FgGreen], "deploy")} ${Colors.colorize([Colors.FgYellow], "[opciones]")}`);
        console.log("");
        console.group();

        console.log(`${Colors.colorize([Colors.FgYellow], "[opciones]")}:`);
        console.group();
        console.log(`${Colors.colorize([Colors.FgMagenta], "Opciones disponibles:")}`);
        console.group();
        console.log(`${Colors.colorize([Colors.FgYellow], "--env")}=${Colors.colorize([Colors.FgGreen], "<entorno>")}: Indica el entorno de compilación`);
        console.log(`                 ${Colors.colorize([Colors.FgWhite], "Valores posibles:")} ${Colors.colorize([Colors.FgGreen], "produccion")}${Colors.colorize([Colors.FgWhite], ",")} ${Colors.colorize([Colors.FgGreen], "test")}`);
        console.groupEnd();
        console.groupEnd();
        console.log("");

        console.groupEnd();
    }
}
