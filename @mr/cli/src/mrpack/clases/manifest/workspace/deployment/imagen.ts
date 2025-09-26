import type {IManifestDeploymentImagen} from "@mr/cli/manifest/deployment/imagen";

export class ManifestWorkspaceDeploymentImagenLoader {
    /* STATIC */
    public static get DEFAULT(): IManifestDeploymentImagen|undefined {
        return undefined;
    }

    public static check(imagen?: Partial<IManifestDeploymentImagen>): IManifestDeploymentImagen|undefined {
        if (imagen===undefined) {
            return this.DEFAULT;
        }
        const data = this.DEFAULT ?? {};
        if (imagen.produccion!=undefined) {
            data.produccion = imagen.produccion;
        }
        if (imagen.test!=undefined) {
            data.test = imagen.test;
        }

        return data;
    }

    /* INSTANCE */
}
