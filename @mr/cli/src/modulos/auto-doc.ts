/**
 * Editor: Bixus
 * Fecha: Mon, 07 Sep 2026 13:12:27 GMT
 * Hash: 9ab9d1d78ac9eabd8ef687eca52cc729
 * Versión: 2026.9.7+1-bixus
 * Anterior: 2026.7.14+1-josantoniojimnez
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

import {type IModulo, type IModuloConfig, Modulo} from "@mr/core-cli/modulo";
import {Colors} from "@mr/core-cli/colors";
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
