/**
 * Editor: miguel
 * Fecha: Tue, 20 Oct 2026 11:07:24 GMT
 * Hash: f08b66dbcc87482039a2323d743d7e2c
 * Versión: 2026.10.20+3-miguel
 * Anterior: 2026.9.23+2-bixus
 * Proyecto: https://github.com/alpred/tiempo-web-javascript.git
 */

import {type IManifestDeployment, ManifestDeployment} from "./deployment/index";
import {type IManifestDevelopment, ManifestDevelopment} from "./development"
import {type IManifestBuild, ManifestBuild} from "./build/index";
import {ManifestRoot} from "./root"

/**
 * Forma serializada completa de un `mrpack.json`.
 * Es la interfaz raíz que lee y escribe la herramienta `mrpack`.
 *
 * @property enabled - Si `false`, `mrpack` ignora el workspace en compilaciones y despliegues.
 * @property deploy - Configuración de despliegue (imagen Docker, Kubernetes, GCS…).
 * @property devel - Configuración de desarrollo local.
 * @property build - Configuración de compilación (framework, bundle, base de datos…).
 */
export interface IManifest {
    enabled: boolean;
    deploy: IManifestDeployment;
    devel: IManifestDevelopment;
    build: IManifestBuild;
}

/**
 * Modelo de datos del archivo `mrpack.json`.
 *
 * Carga, valida y normaliza el manifiesto desde su representación POJO.
 * Todos los sub-objetos se instancian como sus clases correspondientes,
 * garantizando valores por defecto y proporcionando métodos de ayuda.
 *
 * ### Uso típico
 * ```ts
 * import {Manifest} from "@mr/core-dev/manifest";
 * const manifest = new Manifest(JSON.parse(fs.readFileSync("mrpack.json", "utf8")));
 * ```
 */
export class Manifest extends ManifestRoot<IManifest> implements IManifest {
    /* INSTANCE */
    public enabled: boolean;
    public deploy: ManifestDeployment;
    public devel: ManifestDevelopment;
    public build: ManifestBuild;

    public constructor(manifest: IManifest) {
        super();

        this.enabled = manifest.enabled;
        this.deploy = ManifestDeployment.build(manifest.deploy);
        this.devel = ManifestDevelopment.build(manifest.devel);
        this.build = ManifestBuild.build(manifest.build);
    }

    public toJSON(): IManifest {
        return {
            enabled: this.enabled,
            deploy: this.deploy.toJSON(),
            devel: this.devel.toJSON(),
            build: this.build.toJSON(),
        };
    }
}
