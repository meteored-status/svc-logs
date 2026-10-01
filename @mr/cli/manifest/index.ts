/**
 * Editor: Bixus
 * Fecha: Wed, 23 Sep 2026 08:46:25 GMT
 * Hash: a04a9c7c8e55a08c9e0ef8d754642031
 * Versión: 2026.9.23+2-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

import {ManifestRoot} from "@mr/core-dev/manifest/root";

import {type IManifestDeployment, ManifestDeployment} from "./deploy";

/**
 * Estructura del fichero `mrpack.json` raíz del monorepo.
 * Es leído por `mrpack deploy` para controlar el proceso de despliegue global.
 *
 * @property deploy - Parámetros de compilación y despliegue.
 */
export interface IManifest {
    deploy: IManifestDeployment;
}

/**
 * Modelo del manifest raíz del monorepo (`mrpack.json`).
 * Extiende {@link ManifestRoot} e implementa {@link IManifest}.
 */
export class Manifest extends ManifestRoot<IManifest> implements IManifest {
    /* INSTANCE */
    public deploy: ManifestDeployment;

    public constructor(manifest: IManifest) {
        super();

        this.deploy = ManifestDeployment.build(manifest.deploy);
    }

    public toJSON(): IManifest {
        return {
            deploy: this.deploy.toJSON(),
        };
    }
}
