/**
 * Editor: José Antonio Jiménez
 * Fecha: Tue, 14 Jul 2026 07:18:57 GMT
 * Hash: 16ca6d9dc690e71c2964d812cefce37b
 * Versión: 2026.7.14+1-josantoniojimnez
 * Anterior: 2026.5.27+1-josantoniojimnez
 * Proyecto: https://github.com/meteored-status/svc-logs.git
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
