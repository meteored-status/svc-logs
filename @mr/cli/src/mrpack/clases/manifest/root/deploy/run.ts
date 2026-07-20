/**
 * Editor: José Antonio Jiménez
 * Fecha: Tue, 14 Jul 2026 07:18:57 GMT
 * Hash: 1c0096cee72465dc1be6defbbca5832e
 * Versión: 2026.7.14+1-josantoniojimnez
 * Anterior: 2026.5.27+1-josantoniojimnez
 * Proyecto: https://github.com/meteored-status/svc-logs.git
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
     * @param run - Datos parciales de la sección `run`.
     * @returns Configuración de run completa y normalizada.
     */
    public check(run: Partial<IManifestDeploymentRun>={}): IManifestDeploymentRun {
        const data = this.default;
        if (run.enabled !== undefined) {
            data.enabled = run.enabled;
        }
        if (run.latest !== undefined) {
            data.latest = run.latest;
        }

        return data;
    }
}

export default new ManifestRootDeploymentRunLoader();
