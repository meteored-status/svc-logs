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
