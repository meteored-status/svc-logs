export interface IManifestDeploymentImagen {
    produccion?: string;
    test?: string;
}

export class ManifestDeploymentImagen implements IManifestDeploymentImagen {
    /* STATIC */
    public static build(imagen?: IManifestDeploymentImagen): ManifestDeploymentImagen|undefined {
        if (!imagen) {
            return undefined;
        }
        return new this(imagen);
    }

    /* INSTANCE */
    public produccion?: string;
    public test?: string;

    protected constructor(storage: IManifestDeploymentImagen) {
        this.produccion = storage.produccion;
        this.test = storage.test;
    }

    public toJSON(): IManifestDeploymentImagen {
        return {
            produccion: this.produccion,
            test: this.test,
        };
    }
}
