/**
 * Editor: José Antonio Jiménez
 * Fecha: Wed, 27 May 2026 09:00:52 GMT
 * Hash: 4b827c30f23260c2c0b0d6bae588fee9
 * Versión: 2026.5.27+1-josantoniojimnez
 */

import type {IManifestDeployment} from "../../../../../../manifest/deploy";

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
