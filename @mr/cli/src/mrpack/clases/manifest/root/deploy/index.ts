import type {IManifestDeployment} from "../../../../../../manifest/root/deploy";

import {ManifestRootDeploymentBuildLoader} from "./build";
import {ManifestRootDeploymentRunLoader} from "./run";

export class ManifestRootDeploymentLoader {
    /* STATIC */
    public static get DEFAULT(): IManifestDeployment {
        return {
            build: ManifestRootDeploymentBuildLoader.DEFAULT,
            run: ManifestRootDeploymentRunLoader.DEFAULT,
        };
    }

    public static check(bundle?: Partial<IManifestDeployment>): IManifestDeployment {
        const data = this.DEFAULT;
        if (bundle?.build!=undefined) {
            data.build = ManifestRootDeploymentBuildLoader.check(bundle.build);
        }
        if (bundle?.run!=undefined) {
            data.run = ManifestRootDeploymentRunLoader.check(bundle.run);
        }

        return data;
    }

    /* INSTANCE */
}
