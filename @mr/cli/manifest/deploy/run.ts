/**
 * Editor: José Antonio Jiménez
 * Fecha: Fri, 15 May 2026 12:09:04 GMT
 * Hash: 0fb88610df4a537a94082c7833d3b9d1
 */

/**
 * Configuración de la fase de ejecución del despliegue.
 *
 * @property enabled - Si `true`, se ejecuta el despliegue tras la compilación. Por defecto `true`.
 * @property latest  - Si `true`, se despliega la última versión generada aunque no se haya compilado en esta ejecución.
 *                     Útil cuando se generó una versión nueva previamente pero no se desplegó. Por defecto `false`.
 */
export interface IManifestDeploymentRun {
    enabled: boolean;
    latest: boolean;
}

/**
 * Modelo de la fase de ejecución del despliegue.
 * Implementa {@link IManifestDeploymentRun} y expone `toJSON()` para serialización.
 */
export class ManifestDeploymentRun implements IManifestDeploymentRun {
    /* STATIC */
    public static build(deploy: IManifestDeploymentRun): ManifestDeploymentRun {
        return new this(deploy);
    }

    /* INSTANCE */
    public enabled: boolean;
    public latest: boolean;

    protected constructor(deploy: IManifestDeploymentRun) {
        this.enabled = deploy.enabled;
        this.latest = deploy.latest;
    }

    public toJSON(): IManifestDeploymentRun {
        return {
            enabled: this.enabled,
            latest: this.latest,
        };
    }
}
