/**
 * Editor: Juan C. Martínez
 * Fecha: Thu, 21 May 2026 10:53:23 GMT
 * Hash: a876821fa31a3745c26d263354036fe7
 * Versión: 2026.5.21+3-juancmartinez
 */

/**
 * @fileoverview Configuración de un overlay de annotations para el workspace.
 */
type TManifestDeploymentAnnotations = Record<string, string>;

/**
 * Configuración de un overlay de annotations para el workspace.
 *
 * @property service - Anotaciones a inyectar en el servicio: `{ nombre: valor }`.
 */
export interface IManifestDeploymentAnnotations {
    service?: TManifestDeploymentAnnotations;
}

/**
 * Modelo de un elemento de `deploy.annotations` en `mrpack.json`.
 */
export class ManifestDeploymentAnnotations implements IManifestDeploymentAnnotations {
    /* INSTANCE */
    public service?: TManifestDeploymentAnnotations;

    protected constructor(deploy?: IManifestDeploymentAnnotations) {
        this.service = deploy?.service;
    }

    /* STATIC */
    /**
     * Crea una instancia del modelo de annotations a partir del objeto plano del manifest.
     *
     * @param deploy Datos de `deploy.annotations` en `mrpack.json`.
     * @returns Instancia normalizada para uso interno.
     */
    public static build(deploy?: IManifestDeploymentAnnotations): ManifestDeploymentAnnotations {
        return new this(deploy);
    }

    /**
     * Serializa el modelo al formato JSON del manifest.
     *
     * @returns Objeto con la estructura de `deploy.annotations`.
     */
    public toJSON(): IManifestDeploymentAnnotations {
        return {
            service: this.service,
        };
    }
}
