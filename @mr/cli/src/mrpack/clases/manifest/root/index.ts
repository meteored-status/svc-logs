import {type IManifest, Manifest} from "../../../../../manifest/root";

import {ManifestLoader} from "../index";
import {ManifestRootDeploymentLoader} from "./deploy";

export class ManifestRootLoader extends ManifestLoader<IManifest, Manifest> {
    /* STATIC */
    public static get DEFAULT(): IManifest {
        return {
            deploy: ManifestRootDeploymentLoader.DEFAULT,
        };
    }

    /* INSTANCE */
    public constructor(basedir: string) {
        super(basedir, Manifest, ManifestRootLoader);
    }

    public check(manifest?: Partial<IManifest>): IManifest {
        const data = this.defecto.DEFAULT;
        if (manifest?.deploy!=undefined) {
            data.deploy = ManifestRootDeploymentLoader.check(manifest.deploy);
        }

        return data;
    }

    public override async load(): Promise<ManifestRootLoader> {
        return super.load();
    }

    public override loadSync(): ManifestRootLoader {
        return super.loadSync();
    }
}
