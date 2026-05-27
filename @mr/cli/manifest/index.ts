/**
 * Editor: José Antonio Jiménez
 * Fecha: Fri, 15 May 2026 12:09:04 GMT
 * Hash: b82eb8f484fa3c20f3c622b668494c04
 */

import {type IManifestDeployment, ManifestDeployment} from "./deploy";
import {ManifestRoot} from "@mr/core-dev/manifest/root";

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
    /* STATIC */

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
