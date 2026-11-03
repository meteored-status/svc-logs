/**
 * Editor: alexCG
 * Fecha: Tue, 20 Oct 2026 07:44:09 GMT
 * Hash: 1cc88460a0e5c80ef50458d400c6185f
 * Versión: 2026.10.20+1-alexcg
 * Proyecto: https://github.com/alpred/meteored-svc-amateur.git
 */

import {type IModulo, type IModuloConfig, Modulo} from "@mr/core-cli/modulo";
import {Colors} from "@mr/core-cli/colors";

import {alta, estado, limpiar, mensajeError, reset} from "../clases/pubsub";
import {Log} from "../clases/log";

export interface IPubSubConfig extends IModuloConfig {
    options: IModuloConfig["options"] & {
        up:      { type: "boolean"; short: "u"; default: false };
        status:  { type: "boolean"; short: "s"; default: false };
        reset:   { type: "boolean"; short: "r"; default: false };
        limpiar: { type: "boolean"; short: "l"; default: false };
    };
}

export interface IPubSub extends IModulo {
    up:      boolean;
    status:  boolean;
    reset:   boolean;
    limpiar: boolean;
}

/**
 * Módulo CLI `mrpack pubsub`: da de alta, comprueba, purga y limpia en el emulador de Pub/Sub local la topología que los
 * workspaces declaran en sus `mrpack.pubsub.ts`.
 */
export class ModuloPubSub<T extends IPubSubConfig> extends Modulo<T> {
    /* STATIC */
    protected static override OPTIONS: IPubSubConfig = {
        ...Modulo.OPTIONS,
        options: {
            ...Modulo.OPTIONS.options,
            up:      { type: "boolean", short: "u", default: false },
            status:  { type: "boolean", short: "s", default: false },
            reset:   { type: "boolean", short: "r", default: false },
            limpiar: { type: "boolean", short: "l", default: false },
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
     * Ejecuta la acción indicada (`up`, `status`, `reset`, `limpiar`) o muestra la ayuda si no hay ninguna.
     *
     * Los errores esperados (emulador caído, declaración no válida) se muestran sin traza y terminan el proceso con código
     * de salida distinto de cero. Un repo sin declaraciones no es un error.
     *
     * @param config - Opciones del módulo (`help`, `up`, `status`, `reset`, `limpiar`).
     */
    protected async parseParams(config: IPubSub): Promise<void> {
        const acciones = [config.up, config.status, config.reset, config.limpiar].filter((activa) => activa).length;
        if (config.help || acciones === 0) {
            this.mostrarAyuda();
            return;
        }
        if (acciones > 1) {
            Log.error({type: Log.label_pubsub, label: "pubsub"}, "Indica una sola acción: -u, -s, -r o -l");
            this.mostrarAyuda();
            return Promise.reject();
        }

        try {
            if (config.up) {
                await alta(this.root);
            } else if (config.status) {
                await estado(this.root);
            } else if (config.reset) {
                await reset(this.root);
            } else {
                await limpiar(this.root);
            }
        } catch (err) {
            Log.error({type: Log.label_pubsub, label: "pubsub"}, mensajeError(err));
            return Promise.reject();
        }
    }

    protected mostrarAyuda(): void {
        console.log(`${Colors.colorize([Colors.FgCyan, Colors.Bright], "Descripción")}: Emulador de Pub/Sub local (topología de mrpack.pubsub.ts)`);
        console.log(`${Colors.colorize([Colors.FgCyan, Colors.Bright], "Uso")}:         ${Colors.colorize([Colors.FgBlue], "yarn mrpack")} ${Colors.colorize([Colors.FgGreen], "pubsub")} ${Colors.colorize([Colors.FgYellow], "<opción>")}`);
        console.log("");
        console.log("Cada workspace declara en su mrpack.pubsub.ts los topics que publica y las suscripciones que consume;");
        console.log("mrpack las junta y las da de alta en el emulador (docker `pubsub` de mrenv). No arranca el docker.");
        console.log("");
        console.log(`  ${Colors.colorize([Colors.FgYellow], "-u")}, ${Colors.colorize([Colors.FgYellow], "--up")}        Da de alta la topología declarada (crea lo que falta y corrige lo que difiere)`);
        console.log(`  ${Colors.colorize([Colors.FgYellow], "-s")}, ${Colors.colorize([Colors.FgYellow], "--status")}    Estado: cada recurso declarado, lo que sobra en el emulador y si los servicios push responden en modo emulador`);
        console.log(`  ${Colors.colorize([Colors.FgYellow], "-r")}, ${Colors.colorize([Colors.FgYellow], "--reset")}     Purga las suscripciones declaradas: las borra y recrea, y descarta sus mensajes pendientes`);
        console.log(`  ${Colors.colorize([Colors.FgYellow], "-l")}, ${Colors.colorize([Colors.FgYellow], "--limpiar")}   Borra lo que este repo dio de alta y ya no declara (lo ajeno no se toca)`);
        console.log(`  ${Colors.colorize([Colors.FgYellow], "-h")}, ${Colors.colorize([Colors.FgYellow], "--help")}      Muestra esta ayuda`);
        console.log("");
        console.log("Una sola opción por llamada. El emulador se busca en PUBSUB_EMULATOR_HOST, el bloque `pubsub` de");
        console.log("config.workspaces.json o localhost:8085.");
        console.log("");
    }
}
