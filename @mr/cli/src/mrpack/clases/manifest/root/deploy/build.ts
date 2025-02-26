import type {IManifestDeploymentBuild} from "../../../../../../manifest/root/deploy/build";

export class ManifestRootDeploymentBuildLoader {
    /* STATIC */
    public static get DEFAULT(): IManifestDeploymentBuild {
        return {
            enabled: true,
            force: false,
        };
    }

    public static check(devel: Partial<IManifestDeploymentBuild>={}): IManifestDeploymentBuild {
        const data = this.DEFAULT;
        if (devel.enabled!=undefined) {
            data.enabled = devel.enabled;
        }

        return data;
    }

    /* INSTANCE */
}
