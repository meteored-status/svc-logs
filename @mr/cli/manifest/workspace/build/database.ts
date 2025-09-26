export interface IManifestBuildDatabase {
    produccion?: string;
    test?: string;
}

export class ManifestBuildDatabase implements IManifestBuildDatabase {
    /* STATIC */
    public static build(database?: IManifestBuildDatabase): ManifestBuildDatabase|undefined {
        if (!database) {
            return undefined;
        }
        return new this(database);
    }

    /* INSTANCE */
    public produccion?: string;
    public test?: string;

    protected constructor(storage: IManifestBuildDatabase) {
        this.produccion = storage.produccion;
        this.test = storage.test;
    }

    public toJSON(): IManifestBuildDatabase {
        return {
            produccion: this.produccion,
            test: this.test,
        };
    }
}
