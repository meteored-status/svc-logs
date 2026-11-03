/**
 * Editor: miguel
 * Fecha: Tue, 20 Oct 2026 11:07:24 GMT
 * Hash: f0a60915f6b79039a301743352b6e7ba
 * Versión: 2026.10.20+3-miguel
 * Anterior: 2026.5.21+1-josantoniojimnez
 * Proyecto: https://github.com/alpred/tiempo-web-javascript.git
 */

import {type IManifestDeploymentImagenEntorno, ManifestDeploymentImagenEntorno} from "./entorno";

/**
 * Configuración de la imagen Docker del workspace, diferenciada por entorno.
 *
 * @property produccion - Configuración de la imagen para el entorno de producción.
 * @property test - Configuración de la imagen para el entorno de test/staging.
 */
export interface IManifestDeploymentImagen {
    produccion: IManifestDeploymentImagenEntorno;
    test: IManifestDeploymentImagenEntorno;
}

/**
 * Modelo de la sección `deploy.imagen` de `mrpack.json`.
 */
export class ManifestDeploymentImagen implements IManifestDeploymentImagen {
    /* STATIC */
    public static build(imagen?: IManifestDeploymentImagen): ManifestDeploymentImagen|undefined {
        if (!imagen) {
            return undefined;
        }
        return new this(imagen);
    }

    /* INSTANCE */
    public produccion: ManifestDeploymentImagenEntorno;
    public test: ManifestDeploymentImagenEntorno;

    protected constructor(storage: IManifestDeploymentImagen) {
        this.produccion = ManifestDeploymentImagenEntorno.build(storage.produccion);
        this.test = ManifestDeploymentImagenEntorno.build(storage.test);
    }

    public toJSON(): IManifestDeploymentImagen {
        return {
            produccion: this.produccion,
            test: this.test,
        };
    }
}
