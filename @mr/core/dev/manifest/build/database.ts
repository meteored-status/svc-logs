/**
 * Nombre de la base de datos MySQL por entorno de ejecución.
 * Solo se define cuando el workspace necesita acceso a BD.
 *
 * @property produccion - Nombre de la BD en el entorno de producción.
 * @property test - Nombre de la BD en el entorno de test/staging.
 */
export interface IManifestBuildDatabase {
    produccion?: string;
    test?: string;
}

/**
 * Modelo del campo `build.database` de `mrpack.json`.
 */
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
