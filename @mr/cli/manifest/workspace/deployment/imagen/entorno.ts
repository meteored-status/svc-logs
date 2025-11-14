export interface IManifestDeploymentImagenEntorno {
    base?: string;
    registro?: string;
    paquete: string;
    nombre: string;
}

export class ManifestDeploymentImagenEntorno implements IManifestDeploymentImagenEntorno {
    /* STATIC */
    public static build(entorno: IManifestDeploymentImagenEntorno): ManifestDeploymentImagenEntorno {
        return new this(entorno);
    }

    /* INSTANCE */
    public base?: string;
    public registro?: string;
    public paquete: string;
    public nombre: string;

    protected constructor(entorno: IManifestDeploymentImagenEntorno) {
        this.base = entorno.base;
        this.registro = entorno.registro;
        this.paquete = entorno.paquete;
        this.nombre = entorno.nombre;
    }

    public toJSON(): IManifestDeploymentImagenEntorno {
        return {
            base: this.base,
            registro: this.registro,
            paquete: this.paquete,
            nombre: this.nombre,
        };
    }
}
