/**
 * Editor: Bixus
 * Fecha: Wed, 23 Sep 2026 08:46:26 GMT
 * Hash: bfe1159442ae3ec95dd77a5bb79f9185
 * Versión: 2026.9.23+1-bixus
 * Anterior: 2026.9.18+1-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

export interface IModulo {
    id: string;
    version: number;
}

export interface IModuloConfig {
}

export interface IPackageConfig {
    lang?: string;
    langs: string[];
}

export abstract class Modulo<T extends IModuloConfig=IModuloConfig> {
    /* INSTANCE */
    protected constructor(private readonly _original: IModulo, protected config: T) {
    }

    protected get original(): IModulo {
        return this._original;
    }

    public get id(): string {
        return this.original.id;
    }
}
