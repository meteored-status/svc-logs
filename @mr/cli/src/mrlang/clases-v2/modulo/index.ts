/**
 * Editor: José Antonio Jiménez
 * Fecha: Fri, 15 May 2026 12:09:04 GMT
 * Hash: 76b7a6428a3f362c0b3207852fe2d909
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
    /* STATIC */

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
