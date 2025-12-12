import type {IManifestDeploymentImagenEntorno} from "@mr/cli/manifest/deployment/imagen/entorno";

class ManifestWorkspaceDeploymentImagenEntornoLoader {
    /* INSTANCE */
    public get default(): IManifestDeploymentImagenEntorno {
        return {
            paquete: "services",
            nombre: "defecto",
        };
    }

    public check(imagen?: Partial<IManifestDeploymentImagenEntorno>): IManifestDeploymentImagenEntorno {
        const data = this.default;
        if (!imagen) {
            return data;
        }

        if (imagen.base) {
            data.base = imagen.base;
        }
        if (imagen.registro) {
            data.registro = imagen.registro;
        }
        if (imagen.paquete) {
            data.paquete = imagen.paquete;
        }
        if (imagen.nombre) {
            data.nombre = imagen.nombre;
        }

        return data;
    }
}

export default new ManifestWorkspaceDeploymentImagenEntornoLoader();
