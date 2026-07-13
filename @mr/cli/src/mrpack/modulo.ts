/**
 * Editor: José Antonio Jiménez
 * Fecha: Tue, 14 Jul 2026 07:18:57 GMT
 * Hash: 939ef3bf1dad55bf5ffa9c83a1fc5b89
 * Versión: 2026.7.14+1-josantoniojimnez
 * Anterior: 2026.6.25+5-josantoniojimnez
 * Proyecto: https://github.com/meteored-status/svc-logs.git
 */

import {parseArgs, type ParseArgsConfig} from "node:util";

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
                if (err!==undefined) {
                    console.error(err);
                }
            });
    }

    /* INSTANCE */
    public readonly root: string;

    protected constructor(protected config: T) {
        this.root = process.env["MRPACK_ROOT"] ?? process.cwd();
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
    protected async parsePositionals(_positionals: string[]): Promise<void> {

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
