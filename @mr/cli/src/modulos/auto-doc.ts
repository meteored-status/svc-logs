/**
 * Editor: Juan C. Martínez
 * Fecha: Wed, 11 Nov 2026 10:30:12 GMT
 * Hash: 1f3188a9abea8d1428f34a0ec649181f
 * Versión: 2026.11.11+2-juancmartinez
 * Anterior: 2026.9.23+2-bixus
 * Proyecto: git@github.com:alpred/meteored-svc-panel-usuarios.git
 */

import {type IModulo, type IModuloConfig, Modulo} from "@mr/core-cli/modulo";
import {Colors} from "@mr/core-cli/colors";

import {run} from "../clases/auto-doc";

export interface IAutoDocConfig extends IModuloConfig {
    options: IModuloConfig["options"] & {
        env: { type: "string" };
        out: { type: "string" };
        "dry-run": { type: "boolean" };
        servicio: { type: "string" };
        strict: { type: "boolean" };
    };
}

export interface IAutoDoc extends IModulo {
    env?: string;
    out?: string;
    "dry-run"?: boolean;
    servicio?: string;
    strict?: boolean;
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
            out: { type: "string", },
            "dry-run": { type: "boolean", },
            servicio: { type: "string", },
            strict: { type: "boolean", },
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
        } else if (config.env !== undefined || config.out !== undefined || config["dry-run"]) {
            await run(this.root, { env: config.env, out: config.out, dryRun: config["dry-run"], servicio: config.servicio, strict: config.strict });
        } else {
            this.mostrarAyuda();
        }
    }

    protected mostrarAyuda(): void {
        console.log(`${Colors.colorize([Colors.FgCyan, Colors.Bright], "Descripción")}: Genera la documentación automática del proyecto`);
        console.log("");
        console.group();
        console.log(`${Colors.colorize([Colors.FgCyan], "--env=<entorno>")}      Guarda los documentos en MySQL (base \`doc\`, tablas \`openapi_service\` y \`openapi_version\`)`);
        console.log(`${Colors.colorize([Colors.FgCyan], "--out=<dir>")}          Escribe \`<dir>/<deployment>.openapi.json\` en vez de usar MySQL`);
        console.log(`${Colors.colorize([Colors.FgCyan], "--dry-run")}            Genera y valida sin escribir nada`);
        console.log(`${Colors.colorize([Colors.FgCyan], "--servicio=<ws>")}      Solo documenta ese workspace de services/`);
        console.log(`${Colors.colorize([Colors.FgCyan], "--strict")}             Los avisos hacen fallar la generación del servicio`);
        console.groupEnd();
    }

}
