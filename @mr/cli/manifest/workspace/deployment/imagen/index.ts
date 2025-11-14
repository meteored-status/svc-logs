import {type IManifestDeploymentImagenEntorno, ManifestDeploymentImagenEntorno} from "./entorno";

export interface IManifestDeploymentImagen {
    produccion: IManifestDeploymentImagenEntorno;
    test: IManifestDeploymentImagenEntorno;
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
    public produccion: ManifestDeploymentImagenEntorno;
    public test: ManifestDeploymentImagenEntorno;

    protected constructor(storage: IManifestDeploymentImagen) {
        this.produccion = ManifestDeploymentImagenEntorno.build(storage.produccion);
        this.test = ManifestDeploymentImagenEntorno.build(storage.test);
    }

    public toJSON(): IManifestDeploymentImagen {
        return {
            produccion: this.produccion,
            test: this.test,
        };
    }
}
