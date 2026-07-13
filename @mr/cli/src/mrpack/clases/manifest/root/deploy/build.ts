/**
 * Editor: José Antonio Jiménez
 * Fecha: Wed, 27 May 2026 09:00:52 GMT
 * Hash: f9b98dd324897df0b5617df73b766585
 * Versión: 2026.5.27+1-josantoniojimnez
 */

import type {IManifestDeploymentBuild} from "../../../../../../manifest/deploy/build";

class ManifestRootDeploymentBuildLoader {
    /* INSTANCE */
    public get default(): IManifestDeploymentBuild {
        return {
            enabled: true,
            force: false,
        };
    }

    /**
     * Normaliza y valida la sección `build` del despliegue raíz.
     *
     * @param build - Datos parciales de la sección `build`.
     * @returns Configuración de build completa y normalizada.
     */
    public check(build: Partial<IManifestDeploymentBuild>={}): IManifestDeploymentBuild {
        const data = this.default;
        if (build.enabled !== undefined) {
            data.enabled = build.enabled;
        }
        if (build.force !== undefined) {
            data.force = build.force;
        }

        return data;
    }
}

export default new ManifestRootDeploymentBuildLoader();
