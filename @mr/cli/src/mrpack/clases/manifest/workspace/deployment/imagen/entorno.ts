import type {IManifestDeploymentImagenEntorno} from "@mr/cli/manifest/deployment/imagen/entorno";

export class ManifestWorkspaceDeploymentImagenEntornoLoader {
    /* STATIC */
    public static get DEFAULT(): IManifestDeploymentImagenEntorno {
        return {
            paquete: "services",
            nombre: "defecto",
        };
    }

    public static check(imagen?: Partial<IManifestDeploymentImagenEntorno>): IManifestDeploymentImagenEntorno {
        const data = this.DEFAULT;
        if (!imagen) {
            return data;
        }

        if (imagen.base!=undefined) {
            data.base = imagen.base;
        }
        if (imagen.registro!=undefined) {
            data.registro = imagen.registro;
        }
        if (imagen.paquete!=undefined) {
            data.paquete = imagen.paquete;
        }
        if (imagen.nombre!=undefined) {
            data.nombre = imagen.nombre;
        }

        return data;
    }

    /* INSTANCE */
}
