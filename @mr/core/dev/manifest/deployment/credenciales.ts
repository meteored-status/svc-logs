/**
 * Par de rutas que describe una credencial a importar en el contenedor durante el despliegue.
 *
 * @property source - Ruta al fichero de credenciales en el sistema de secretos origen.
 * @property target - Ruta destino relativa al workspace donde se montará la credencial.
 */
export interface IManifestDeploymentCredenciales {
    source: string;
    target: string;
}

/**
 * Modelo de un elemento de `deploy.credenciales` en `mrpack.json`.
 */
export class ManifestDeploymentCredenciales implements IManifestDeploymentCredenciales {
    /* STATIC */
    public static build(credenciales: IManifestDeploymentCredenciales): ManifestDeploymentCredenciales {
        return new this(credenciales);
    }

    /* INSTANCE */
    public source: string;
    public target: string;

    protected constructor(credenciales: IManifestDeploymentCredenciales) {
        this.source = credenciales.source;
        this.target = credenciales.target;
    }

    public toJSON(): IManifestDeploymentCredenciales {
        return {
            source: this.source,
            target: this.target,
        };
    }
}
