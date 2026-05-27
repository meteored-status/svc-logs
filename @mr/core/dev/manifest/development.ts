/**
 * Configuración de desarrollo local de un workspace.
 *
 * @property enabled - Si `true`, el workspace puede levantarse en modo watch con `yarn devel`.
 */
export interface IManifestDevelopment {
    enabled: boolean;
}

/**
 * Modelo de la sección `devel` de `mrpack.json`.
 * Controla si el workspace participa en el ciclo de desarrollo local.
 */
export class ManifestDevelopment implements IManifestDevelopment {
    /* STATIC */
    public static build(devel: IManifestDevelopment): ManifestDevelopment {
        return new this(devel);
    }

    /* INSTANCE */
    public enabled: boolean;

    protected constructor(devel: IManifestDevelopment) {
        this.enabled = devel.enabled;
    }

    public toJSON(): IManifestDevelopment {
        return {
            enabled: this.enabled,
        };
    }
}
