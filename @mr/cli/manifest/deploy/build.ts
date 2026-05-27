/**
 * Editor: José Antonio Jiménez
 * Fecha: Fri, 15 May 2026 12:09:04 GMT
 * Hash: 98f59cb9337779c4b05c07ca968076d7
 */

/**
 * Configuración de la fase de compilación del despliegue.
 *
 * @property enabled - Si `true`, el proceso de despliegue compilará los workspaces. Por defecto `true`.
 * @property force   - Si `true`, se genera una nueva versión aunque el hash de los artefactos no haya cambiado. Por defecto `false`.
 */
export interface IManifestDeploymentBuild {
    enabled: boolean;
    force: boolean;
}

/**
 * Modelo de la fase de compilación del despliegue.
 * Implementa {@link IManifestDeploymentBuild} y expone `toJSON()` para serialización.
 */
export class ManifestDeploymentBuild implements IManifestDeploymentBuild {
    /* STATIC */
    public static build(deploy: IManifestDeploymentBuild): ManifestDeploymentBuild {
        return new this(deploy);
    }

    /* INSTANCE */
    public enabled: boolean;
    public force: boolean;

    protected constructor(deploy: IManifestDeploymentBuild) {
        this.enabled = deploy.enabled;
        this.force = deploy.force;
    }

    public toJSON(): IManifestDeploymentBuild {
        return {
            enabled: this.enabled,
            force: this.force,
        };
    }
}
