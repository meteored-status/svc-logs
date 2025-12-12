import type {IManifestDeploymentRun} from "../../../../../../manifest/root/deploy/run";

class ManifestRootDeploymentRunLoader {
    /* INSTANCE */
    public get default(): IManifestDeploymentRun {
        return {
            enabled: true,
            latest: false,
        };
    }

    public check(devel: Partial<IManifestDeploymentRun>={}): IManifestDeploymentRun {
        const data = this.default;
        if (devel.enabled) {
            data.enabled = devel.enabled;
        }
        if (devel.enabled) {
            data.enabled = devel.enabled;
        }

        return data;
    }
}

export default new ManifestRootDeploymentRunLoader();
