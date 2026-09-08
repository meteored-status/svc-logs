/**
 * Editor: Bixus
 * Fecha: Mon, 07 Sep 2026 13:12:27 GMT
 * Hash: 9a2da79fb44c4a702b6cbc3cef5e3882
 * Versión: 2026.9.7+1-bixus
 * Anterior: 2026.7.14+1-josantoniojimnez
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

import type {IManifestDeploymentRun} from "../../../../../manifest/deploy/run";

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
