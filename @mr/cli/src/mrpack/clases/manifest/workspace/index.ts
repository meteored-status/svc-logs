import {type IManifest, Manifest} from "@mr/cli/manifest";

import type {IManifestLegacy} from "./legacy";
import {ManifestLoader} from "..";
import {ManifestWorkspaceDeploymentLoader} from "./deployment";
import {ManifestWorkspaceDevelopmentLoader} from "./development";
import {ManifestWorkspaceBuildLoader} from "./build";

export class ManifestWorkspaceLoader extends ManifestLoader<IManifest, Manifest> {
    /* STATIC */
    public static get DEFAULT(): IManifest {
        return {
            enabled: true,
            deploy: ManifestWorkspaceDeploymentLoader.DEFAULT,
            devel: ManifestWorkspaceDevelopmentLoader.DEFAULT,
            build: ManifestWorkspaceBuildLoader.DEFAULT,
        };
    }

    /* INSTANCE */
    public constructor(basedir: string) {
        super(basedir, Manifest, ManifestWorkspaceLoader);
    }

    public fromLegacy(config: Partial<IManifestLegacy>): ManifestWorkspaceLoader {
        this.manifest = new Manifest(this.check({
            enabled: config.generar ?? true,
            deploy: ManifestWorkspaceDeploymentLoader.fromLegacy(config),
            devel: ManifestWorkspaceDevelopmentLoader.fromLegacy(config),
            build: ManifestWorkspaceBuildLoader.fromLegacy(config),
        }));

        return this;
    }

    public check(manifest: Partial<IManifest>): IManifest {
        const data = this.defecto.DEFAULT;
        if (manifest.enabled!=undefined) {
            data.enabled = manifest.enabled;
        }
        data.deploy = ManifestWorkspaceDeploymentLoader.check(manifest.deploy);
        data.devel = ManifestWorkspaceDevelopmentLoader.check(manifest.devel);
        data.build = ManifestWorkspaceBuildLoader.check(manifest.build);

        return data;
    }

    public override async load(env?: boolean): Promise<ManifestWorkspaceLoader> {
        return await super.load(env) as ManifestWorkspaceLoader;
    }

    public override loadSync(): ManifestWorkspaceLoader {
        return super.loadSync() as ManifestWorkspaceLoader;
    }

    public applyENV(): void {

    }
}
