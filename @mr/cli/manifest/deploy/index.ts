/**
 * Editor: José Antonio Jiménez
 * Fecha: Fri, 15 May 2026 12:09:04 GMT
 * Hash: 61df71205ab55ab438e93b0160e9297e
 */

import {type IManifestDeploymentBuild, ManifestDeploymentBuild} from "./build";
import {type IManifestDeploymentRun, ManifestDeploymentRun} from "./run";

/**
 * Configuración del proceso de despliegue raíz del monorepo.
 *
 * @property build - Parámetros que controlan la fase de compilación.
 * @property run   - Parámetros que controlan la fase de ejecución del despliegue.
 */
export interface IManifestDeployment {
    build: IManifestDeploymentBuild;
    run: IManifestDeploymentRun;
}

/**
 * Modelo del bloque `deploy` del manifest raíz.
 * Implementa {@link IManifestDeployment} y expone `toJSON()` para serialización.
 */
export class ManifestDeployment implements IManifestDeployment {
    /* STATIC */
    public static build(deploy: IManifestDeployment): ManifestDeployment {
        return new this(deploy);
    }

    /* INSTANCE */
    public build: ManifestDeploymentBuild;
    public run: ManifestDeploymentRun;

    protected constructor(deploy: IManifestDeployment) {
        this.build = ManifestDeploymentBuild.build(deploy.build);
        this.run = ManifestDeploymentRun.build(deploy.run);
    }

    public toJSON(): IManifestDeployment {
        return {
            build: this.build.toJSON(),
            run: this.run.toJSON(),
        };
    }
}
