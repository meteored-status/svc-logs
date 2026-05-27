/**
 * Editor: José Antonio Jiménez
 * Fecha: Wed, 27 May 2026 09:00:52 GMT
 * Hash: 54655b70b741428dde43d2afe54b9c57
 * Versión: 2026.5.27+1-josantoniojimnez
 */

import type {IManifestDeploymentImagenEntorno} from "@mr/core-dev/manifest/deployment/imagen/entorno";

class ManifestWorkspaceDeploymentImagenEntornoLoader {
    /* INSTANCE */
    public get default(): IManifestDeploymentImagenEntorno {
        return {
            paquete: "services",
            nombre: "defecto",
        };
    }

    /**
     * Normaliza y valida la configuración de imagen de un entorno de despliegue.
     *
     * @param imagen - Datos parciales de la configuración de imagen.
     * @returns Configuración de imagen del entorno completa y normalizada.
     */
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
