import type {IManifestDeployment} from "../../../../../../manifest/root/deploy";

import ManifestRootDeploymentBuildLoader from "./build";
import ManifestRootDeploymentRunLoader from "./run";

class ManifestRootDeploymentLoader {
    /* INSTANCE */
    public get default(): IManifestDeployment {
        return {
            build: ManifestRootDeploymentBuildLoader.default,
            run: ManifestRootDeploymentRunLoader.default,
        };
    }

    public check(bundle?: Partial<IManifestDeployment>): IManifestDeployment {
        const data = this.default;
        if (bundle?.build) {
            data.build = ManifestRootDeploymentBuildLoader.check(bundle.build);
        }
        if (bundle?.run) {
            data.run = ManifestRootDeploymentRunLoader.check(bundle.run);
        }

        return data;
    }
}

export default new ManifestRootDeploymentLoader();
