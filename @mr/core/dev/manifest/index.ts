/**
 * Editor: Bixus
 * Fecha: Wed, 23 Sep 2026 08:46:25 GMT
 * Hash: f9ee0e6652ccbe8bb51add4efba0beda
 * Versión: 2026.9.23+2-bixus
 * Anterior: 2026.5.21+1-josantoniojimnez
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

import {type IManifestDeployment, ManifestDeployment} from "./deployment/index.ts";
import {type IManifestDevelopment, ManifestDevelopment} from "./development.ts"
import {type IManifestBuild, ManifestBuild} from "./build/index.ts";
import {ManifestRoot} from "./root.ts"

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
