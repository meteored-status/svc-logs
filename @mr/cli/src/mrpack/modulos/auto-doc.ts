/**
 * Editor: José Antonio Jiménez
 * Fecha: Wed, 27 May 2026 09:00:52 GMT
 * Hash: 368314139e0823b96a7ec9c8efa6e50c
 * Versión: 2026.5.27+1-josantoniojimnez
 */

import {IModulo, IModuloConfig, Modulo} from "../modulo";
import {Colors} from "../clases/colors";
import {run} from "../clases/auto-doc";

export interface IAutoDocConfig extends IModuloConfig {
    options: IModuloConfig["options"] & {
        env: { type: "string" };
    };
}

export interface IAutoDoc extends IModulo {
    env?: string;
}

/**
 * Módulo CLI `mrpack autodoc`: genera la documentación automática del proyecto.
 */
export class ModuloAutoDoc<T extends IAutoDocConfig> extends Modulo<T> {
    /* STATIC */
    protected static override OPTIONS: IAutoDocConfig = {
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
     * Ejecuta la generación de documentación o muestra la ayuda según los flags.
     *
     * @param config - Opciones del módulo (`help`, `env`).
     */
    protected async parseParams(config: IAutoDoc): Promise<void> {
        if (config.help) {
            this.mostrarAyuda();
        } else if (config.env !== undefined) {
            const env: string = config.env;
            run(this.root, { env });
        } else {
            this.mostrarAyuda();
        }
    }

    protected mostrarAyuda(): void {
        console.log(`${Colors.colorize([Colors.FgCyan, Colors.Bright], "Descripción")}: Genera la documentación automática del proyecto`);
        console.log("");
        console.group();

        console.groupEnd();
    }

}
