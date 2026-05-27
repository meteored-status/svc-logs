/**
 * Configuración de la imagen Docker para un entorno concreto (producción o test).
 *
 * @property paquete - Paquete (repositorio) dentro del registro donde se publicará la imagen.
 * @property nombre - Nombre de la imagen que se generará y publicará.
 * @property base - Imagen base usada en el `FROM` del Dockerfile. Por defecto la del runtime del workspace.
 * @property registro - Registro Docker donde se publicará la imagen. Por defecto el configurado en `mrpack`.
 */
export interface IManifestDeploymentImagenEntorno {
    base?: string;
    registro?: string;
    paquete: string;
    nombre: string;
}

/**
 * Modelo de un entorno de imagen Docker en `deploy.imagen`.
 */
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
