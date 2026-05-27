/**
 * Editor: José Antonio Jiménez
 * Fecha: Wed, 27 May 2026 09:00:52 GMT
 * Hash: 3058d3bfa2bbc0ac14d0a29c066ad2d2
 * Versión: 2026.5.27+1-josantoniojimnez
 */

import type {IManifestDeploymentRun} from "../../../../../../manifest/deploy/run";

class ManifestRootDeploymentRunLoader {
    /* INSTANCE */
    public get default(): IManifestDeploymentRun {
        return {
            enabled: true,
            latest: false,
        };
    }

    /**
     * Normaliza y valida la sección `run` del despliegue raíz.
     *
     * @param devel - Datos parciales de la sección `run`.
     * @returns Configuración de run completa y normalizada.
     */
    public check(devel: Partial<IManifestDeploymentRun>={}): IManifestDeploymentRun {
        const data = this.default;
        if (devel.enabled !== undefined) {
            data.enabled = devel.enabled;
        }
        if (devel.latest !== undefined) {
            data.latest = devel.latest;
        }

        return data;
    }
}

export default new ManifestRootDeploymentRunLoader();
