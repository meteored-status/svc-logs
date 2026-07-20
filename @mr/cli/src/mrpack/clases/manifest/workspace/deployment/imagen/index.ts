/**
 * Editor: José Antonio Jiménez
 * Fecha: Tue, 14 Jul 2026 07:18:57 GMT
 * Hash: d10bc73f58a46d91dd280c34b4067033
 * Versión: 2026.7.14+1-josantoniojimnez
 * Anterior: 2026.5.27+1-josantoniojimnez
 * Proyecto: https://github.com/meteored-status/svc-logs.git
 */

import type {IManifestDeploymentImagen} from "@mr/core-dev/manifest/deployment/imagen";

import type {IManifestDeploymentImagenLegacy} from "../../legacy";
import ManifestWorkspaceDeploymentImagenEntornoLoader from "./entorno";

class ManifestWorkspaceDeploymentImagenLoader {
    /* INSTANCE */
    public get default(): IManifestDeploymentImagen {
        return {
            produccion: ManifestWorkspaceDeploymentImagenEntornoLoader.default,
            test: ManifestWorkspaceDeploymentImagenEntornoLoader.default,
        };
    }

    /**
     * Normaliza y valida la configuración de imagen de despliegue (producción y test).
     *
     * @param imagen - Datos parciales de la configuración de imagen (soporta formato legacy con string).
     * @param name   - Nombre del servicio que se usará como nombre de imagen si no se especifica.
     * @returns Configuración de imagen completa y normalizada para ambos entornos.
     */
    public check(imagen?: Partial<IManifestDeploymentImagen|IManifestDeploymentImagenLegacy>, name?: string): IManifestDeploymentImagen {
        const data = this.default;
        if (!imagen) {
            if (name) {
                data.produccion.nombre = name;
                data.test.nombre = name;
            }
            return data;
        }

        if (imagen.produccion) {
            if (typeof imagen.produccion=="string") {
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
            if (typeof imagen.test=="string") {
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
}

export default new ManifestWorkspaceDeploymentImagenLoader();
