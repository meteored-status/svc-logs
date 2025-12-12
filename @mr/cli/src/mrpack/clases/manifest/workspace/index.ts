import {type IManifest, Manifest} from "@mr/cli/manifest";

import type {IManifestLegacy} from "./legacy";
import {ManifestLoader} from "..";
import type {IPackageJsonLegacy} from "../../packagejson";
import ManifestWorkspaceDeploymentLoader from "./deployment";
import ManifestWorkspaceDevelopmentLoader from "./development";
import ManifestWorkspaceBuildLoader from "./build";

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
        this.manifest = new Manifest(this.check({
            enabled: config.generar ?? true,
            deploy: ManifestWorkspaceDeploymentLoader.fromLegacy(config, names),
            devel: ManifestWorkspaceDevelopmentLoader.fromLegacy(config),
            build: ManifestWorkspaceBuildLoader.fromLegacy(config),
        }, paquete));

        return this;
    }

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
        data.build = ManifestWorkspaceBuildLoader.check(manifest.build);

        return data;
    }

    public override async load(env?: boolean, paquete?: IPackageJsonLegacy): Promise<ManifestWorkspaceLoader> {
        return await super.load(env, paquete) as ManifestWorkspaceLoader;
    }

    public override loadSync(paquete?: IPackageJsonLegacy): ManifestWorkspaceLoader {
        return super.loadSync(paquete) as ManifestWorkspaceLoader;
    }

    public applyENV(): void {
        // no hacer nada
    }
}
