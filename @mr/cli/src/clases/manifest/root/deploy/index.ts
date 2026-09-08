/**
 * Editor: Bixus
 * Fecha: Mon, 07 Sep 2026 13:12:27 GMT
 * Hash: a85b71d2b35ace1085fd386a62ab0057
 * Versión: 2026.9.7+1-bixus
 * Anterior: 2026.5.27+1-josantoniojimnez
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

import type {IManifestDeployment} from "../../../../../manifest/deploy";

import ManifestRootDeploymentBuildLoader from "./build";
import ManifestRootDeploymentRunLoader from "./run";

class ManifestRootDeploymentLoader {
    /* INSTANCE */
    public get default(): IManifestDeployment {
        return {
            build: ManifestRootDeploymentBuildLoader.default,
            run: ManifestRootDeploymentRunLoader.default,
        };
    }

    /**
     * Normaliza y valida la sección `deploy` del manifest raíz.
     *
     * @param bundle - Datos parciales de la sección `deploy`.
     * @returns Configuración de deploy completa y normalizada.
     */
    public check(bundle?: Partial<IManifestDeployment>): IManifestDeployment {
        const data = this.default;
        if (bundle?.build) {
            data.build = ManifestRootDeploymentBuildLoader.check(bundle.build);
        }
        if (bundle?.run) {
            data.run = ManifestRootDeploymentRunLoader.check(bundle.run);
        }

        return data;
    }
}

export default new ManifestRootDeploymentLoader();
