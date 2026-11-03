/**
 * Editor: alexCG
 * Fecha: Tue, 20 Oct 2026 07:44:09 GMT
 * Hash: 94f2ce35a092223f50835187ed468e9f
 * Versión: 2026.10.20+1-alexcg
 * Anterior: 2026.9.23+2-bixus
 * Proyecto: https://github.com/alpred/meteored-svc-amateur.git
 */

import {type IModulo, type IModuloConfig, Modulo} from "@mr/core-cli/modulo";
import {Colors} from "@mr/core-cli/colors";

import type {IConfigEjecucion} from "../clases/devel";
import {run} from "../clases/devel";
import {Log} from "../clases/log";

export interface IDevelConfig extends IModuloConfig {
    options: IModuloConfig["options"] & {
        compilar: { type: "boolean", short: "c", default: false, },
        ejecutar: { type: "boolean", short: "e", default: false, },
        forzar:   { type: "boolean", short: "f", default: false, },
        watch:    { type: "boolean", short: "w", default: false, },
        pubsub:   { type: "boolean", short: "p", default: false, },
        solo:     { type: "string", },
    };
}

/**
 * Opciones de `mrpack devel` tal y como las entrega `parseArgs`: `solo` llega como el texto de `--solo=<ws>[,<ws>]`.
 */
export interface IDevel extends IModulo, Omit<IConfigEjecucion, "solo"> {
    solo?: string;
}

/**
 * Módulo CLI `mrpack devel`: inicia la compilación y/o ejecución de los workspaces en modo desarrollo.
 */
export class ModuloDevel<T extends IDevelConfig> extends Modulo<T> {
    /* STATIC */
    protected static override OPTIONS: IDevelConfig = {
        ...Modulo.OPTIONS,
        options: {
            ...Modulo.OPTIONS.options,
            compilar: { type: "boolean", short: "c", default: false, },
            ejecutar: { type: "boolean", short: "e", default: false, },
            forzar:   { type: "boolean", short: "f", default: false, },
            watch:    { type: "boolean", short: "w", default: false, },
            pubsub:   { type: "boolean", short: "p", default: false, },
            solo:     { type: "string", },
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
     * Arranca el entorno de desarrollo o muestra la ayuda según los flags.
     *
     * Requiere al menos `-c` o `-e`; sin ninguno de los dos muestra la ayuda.
     *
     * @param config - Opciones del módulo (`help`, `compilar`, `ejecutar`, `forzar`, `watch`, `pubsub`, `solo`).
     */
    protected async parseParams(config: IDevel): Promise<void> {
        if (config.help || (!config.compilar && !config.ejecutar)) {
            this.mostrarAyuda();
            return;
        }

        const solo = config.solo !== undefined ? [...new Set(config.solo.split(",").map((nombre) => nombre.trim()).filter((nombre) => nombre.length > 0))] : undefined;
        if (solo?.length === 0) {
            Log.error({type: Log.label_base, label: "devel"}, "--solo necesita al menos un workspace: --solo=<ws>[,<ws>]");
            return Promise.reject();
        }

        run(this.root, {compilar: config.compilar, ejecutar: config.ejecutar, forzar: config.forzar, watch: config.watch, pubsub: config.pubsub, solo});
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
        console.log(`${Colors.colorize([Colors.FgBlue], "-w")} ${Colors.colorize([Colors.FgYellow], "--watch")}:    Activa el modo watch; sin esta opción los compiladores compilan una vez y el proceso termina`);
        console.log(`${Colors.colorize([Colors.FgBlue], "-p")} ${Colors.colorize([Colors.FgYellow], "--pubsub")}:   Ejecuta contra el emulador de Pub/Sub local: da de alta la topología de los mrpack.pubsub.ts y la vigila (requiere -e)`);
        console.log(`   ${Colors.colorize([Colors.FgYellow], "--solo")}=<ws>[,<ws>]: Ejecuta solo esos workspaces, aunque config.workspaces.json diga otra cosa (requiere -e)`);
        console.groupEnd();
        console.groupEnd();
        console.log("");

        console.groupEnd();
    }
}
