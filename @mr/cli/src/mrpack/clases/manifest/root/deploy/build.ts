import type {IManifestDeploymentBuild} from "../../../../../../manifest/root/deploy/build";

class ManifestRootDeploymentBuildLoader {
    /* INSTANCE */
    public get default(): IManifestDeploymentBuild {
        return {
            enabled: true,
            force: false,
        };
    }

    public check(devel: Partial<IManifestDeploymentBuild>={}): IManifestDeploymentBuild {
        const data = this.default;
        if (devel.enabled) {
            data.enabled = devel.enabled;
        }

        return data;
    }
}

export default new ManifestRootDeploymentBuildLoader();
