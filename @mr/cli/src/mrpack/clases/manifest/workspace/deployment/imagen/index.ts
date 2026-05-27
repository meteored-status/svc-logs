/**
 * Editor: José Antonio Jiménez
 * Fecha: Wed, 27 May 2026 09:00:52 GMT
 * Hash: 74cff5116bf3bc69aec0dcc5f4d1f991
 * Versión: 2026.5.27+1-josantoniojimnez
 */

import type {IManifestDeploymentImagen} from "@mr/core-dev/manifest/deployment/imagen";

import {IManifestDeploymentImagenLegacy} from "../../legacy";
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
