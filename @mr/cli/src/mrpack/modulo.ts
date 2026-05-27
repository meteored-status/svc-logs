/**
 * Editor: José Antonio Jiménez
 * Fecha: Wed, 27 May 2026 09:00:52 GMT
 * Hash: 0ff3d71d35dfe973b00ec4f3517ab25f
 * Versión: 2026.5.27+1-josantoniojimnez
 */

import {parseArgs, ParseArgsConfig} from "node:util";

import {PromiseDelayed} from "services-comun/modules/utiles/promise";

export interface IModuloConfig extends ParseArgsConfig {
    options: {
        help: { type: "boolean", short: "h", default: false, };
        version?: { type: "string", short: "v", default: "1", };
    };
}

export interface IModulo {
    help: boolean;
}

/**
 * Clase base para los módulos del CLI (`mrpack <modulo>`).
 * Parsea argumentos con `node:util/parseArgs` y delega a `parseParams`.
 */
export abstract class Modulo<T extends IModuloConfig> {
    /* STATIC */
    protected static OPTIONS: IModuloConfig = {
        options: {
            help: { type: "boolean", short: "h", default: false, },
        },
        strict: true,
        allowPositionals: true,
    };

    public static run<T extends IModuloConfig>(modulo: Modulo<T>): void {
        PromiseDelayed()
            .then(async ()=>modulo.run())
            .catch((err)=>{
                if (err!=undefined) {
                    console.error(err)
                // } else {
                //     modulo.mostrarAyuda();
                }
            });
    }

    /* INSTANCE */
    public readonly root: string;

    protected constructor(protected config: T) {
        this.root = process.cwd();
    }

    /**
     * Parsea los argumentos de la línea de comandos y delega en `parsePositionals` y `parseParams`.
     *
     */
    protected async run(): Promise<void> {
        const {values, positionals} = parseArgs<T>(this.config);
        await this.parsePositionals(positionals);
        await this.parseParams(values as IModulo, positionals);
    }

    /**
     * Hook invocado antes de `parseParams` para validar o procesar los argumentos posicionales.
     * Las subclases pueden sobreescribirlo; por defecto es un no-op.
     *
     * @param positionals - Lista de argumentos posicionales de la línea de comandos.
     */
    protected async parsePositionals(positionals: string[]): Promise<void> {

    }

    /**
     * Implementa la lógica principal del módulo a partir de los parámetros ya parseados.
     * Debe ser implementado por cada subclase de `Modulo`.
     *
     * @param config      - Valores parseados de los flags/opciones del módulo.
     * @param positionals - Lista de argumentos posicionales.
     */
    protected abstract parseParams(config: IModulo, positionals?: string[]): Promise<void>;
    protected abstract mostrarAyuda(): void;
}
