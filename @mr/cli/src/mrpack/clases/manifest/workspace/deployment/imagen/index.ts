import type {IManifestDeploymentImagen} from "@mr/cli/manifest/deployment/imagen";
import {IManifestDeploymentImagenLegacy} from "../../legacy";
import {ManifestWorkspaceDeploymentImagenEntornoLoader} from "./entorno";

export class ManifestWorkspaceDeploymentImagenLoader {
    /* STATIC */
    public static get DEFAULT(): IManifestDeploymentImagen {
        return {
            produccion: ManifestWorkspaceDeploymentImagenEntornoLoader.DEFAULT,
            test: ManifestWorkspaceDeploymentImagenEntornoLoader.DEFAULT,
        };
    }

    public static check(imagen?: Partial<IManifestDeploymentImagen|IManifestDeploymentImagenLegacy>, name?: string): IManifestDeploymentImagen {
        const data = this.DEFAULT;
        if (!imagen) {
            if (name) {
                data.produccion.nombre = name;
                data.test.nombre = name;
            }
            return data;
        }

        if (imagen.produccion) {
            if (typeof imagen.produccion==="string") {
                data.produccion = ManifestWorkspaceDeploymentImagenEntornoLoader.check();
                data.produccion.base = imagen.produccion;
                if (name) {
                    data.produccion.nombre = name;
                }
            } else {
                data.produccion = ManifestWorkspaceDeploymentImagenEntornoLoader.check(imagen.produccion);
            }
        }
        if (imagen.test) {
            if (typeof imagen.test==="string") {
                data.test = ManifestWorkspaceDeploymentImagenEntornoLoader.check();
                data.test.base = imagen.test;
                if (name) {
                    data.test.nombre = name;
                }
            } else {
                data.test = ManifestWorkspaceDeploymentImagenEntornoLoader.check(imagen.test);
            }
        }

        return data;
    }

    /* INSTANCE */
}
