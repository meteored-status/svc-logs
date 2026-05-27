/**
 * Editor: José Antonio Jiménez
 * Fecha: Thu, 21 May 2026 06:51:30 GMT
 * Hash: 7624b652e3a15cefbba1770d7897610a
 * Versión: 2026.5.21+1-josantoniojimnez
 */

import {type IManifestDeploymentImagenEntorno, ManifestDeploymentImagenEntorno} from "./entorno.ts";

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
