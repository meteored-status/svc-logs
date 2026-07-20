/**
 * Editor: José Antonio Jiménez
 * Fecha: Fri, 03 Jul 2026 07:12:34 GMT
 * Hash: 2d50fefd45ed0e6087ec51c2843fa585
 * Versión: 2026.7.3+1-josantoniojimnez
 * Anterior: 2026.7.1+1-josantoniojimnez
 * Proyecto: https://github.com/alpred/meteored-svc-ads.git
 */

import {type IManifest, Manifest} from "@mr/core-dev/manifest";

import type {IManifestLegacy} from "./legacy";
import {ManifestLoader} from "..";
import type {IPackageJsonLegacy} from "../../packagejson";
import ManifestWorkspaceDeploymentLoader from "./deployment";
import ManifestWorkspaceDevelopmentLoader from "./development";
import ManifestWorkspaceBuildLoader from "./build";

/**
 * Cargador del manifest de un workspace (`mrpack.json` dentro de `services/`, `jobs/`, etc.).
 * Normaliza el `deploy`, `devel` y `build`, y soporta la migración desde formatos legacy.
 */
export class ManifestWorkspaceLoader extends ManifestLoader<IManifest, Manifest> {
    /* STATIC */
    public static get default(): IManifest {
        return {
            enabled: true,
            deploy: ManifestWorkspaceDeploymentLoader.default,
            devel: ManifestWorkspaceDevelopmentLoader.default,
            build: ManifestWorkspaceBuildLoader.default,
        };
    }

    /* INSTANCE */
    public constructor(basedir: string) {
        super(basedir, Manifest, ManifestWorkspaceLoader);
    }

    /**
     * Migra un manifest en formato legacy al formato actual del workspace.
     *
     * @param config  - Datos en formato legacy a migrar.
     * @param paquete - Package.json legacy del workspace, usado para extraer el campo `servicio`.
     * @returns La propia instancia del loader con el manifest actualizado.
     */
    public fromLegacy(config: Partial<IManifestLegacy>, paquete?: IPackageJsonLegacy): ManifestWorkspaceLoader {
        let names: string[];
        if (paquete?.servicio===undefined) {
            names = [];
        } else if (Array.isArray(paquete.servicio)) {
            names = paquete.servicio;
            delete paquete.servicio;
        } else {
            names = [paquete.servicio];
            delete paquete.servicio;
        }
        const deploy = ManifestWorkspaceDeploymentLoader.fromLegacy(config, names);
        this.manifest = new Manifest(this.check({
            enabled: config.generar ?? true,
            deploy,
            devel: ManifestWorkspaceDevelopmentLoader.fromLegacy(config),
            build: ManifestWorkspaceBuildLoader.fromLegacy(config, {runtime: deploy.runtime, dependencies: paquete?.dependencies}),
        }, paquete));

        return this;
    }

    /**
     * Normaliza y valida el manifest de un workspace, completando con los defaults.
     *
     * @param manifest - Datos parciales leídos del `mrpack.json` del workspace.
     * @param paquete  - Package.json legacy del workspace, usado para extraer el campo `servicio`.
     * @returns Objeto de manifest de workspace completo y normalizado.
     */
    public check(manifest: Partial<IManifest>, paquete?: IPackageJsonLegacy): IManifest {
        const data = this.defecto.default;
        if (manifest.enabled!==undefined) {
            data.enabled = manifest.enabled;
        }
        let names: string[];
        if (paquete?.servicio===undefined) {
            names = [];
        } else if (Array.isArray(paquete.servicio)) {
            names = paquete.servicio;
            delete paquete.servicio;
        } else {
            names = [paquete.servicio];
            delete paquete.servicio;
        }
        data.deploy = ManifestWorkspaceDeploymentLoader.check(manifest.deploy, names);
        data.devel = ManifestWorkspaceDevelopmentLoader.check(manifest.devel);
        data.build = ManifestWorkspaceBuildLoader.check(manifest.build, {runtime: data.deploy.runtime, dependencies: paquete?.dependencies});

        return data;
    }

    /**
     * Carga el manifest del workspace desde disco de forma asíncrona.
     *
     * @param env     - Si `true`, aplica las variables de entorno al manifest tras cargarlo.
     * @param paquete - Package.json legacy del workspace, usado en la normalización.
     * @returns Promesa que resuelve con la propia instancia del loader.
     */
    public override async load(env?: boolean, paquete?: IPackageJsonLegacy): Promise<ManifestWorkspaceLoader> {
        return await super.load(env, paquete) as ManifestWorkspaceLoader;
    }

    /**
     * Carga el manifest del workspace desde disco de forma síncrona.
     *
     * @param paquete - Package.json legacy del workspace, usado en la normalización.
     * @returns La propia instancia del loader para encadenar llamadas.
     */
    public override loadSync(paquete?: IPackageJsonLegacy): ManifestWorkspaceLoader {
        return super.loadSync(paquete) as ManifestWorkspaceLoader;
    }

    public applyENV(): void {
        // no hacer nada
    }
}
