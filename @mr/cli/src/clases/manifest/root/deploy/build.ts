/**
 * Editor: Bixus
 * Fecha: Mon, 07 Sep 2026 13:12:27 GMT
 * Hash: ef326f4b64a0723b68c1f7812d0b86d1
 * Versión: 2026.9.7+1-bixus
 * Anterior: 2026.7.14+1-josantoniojimnez
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

import type {IManifestDeploymentBuild} from "../../../../../manifest/deploy/build";

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
