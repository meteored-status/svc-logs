import type {IManifestDeploymentRun} from "../../../../../../manifest/root/deploy/run";

export class ManifestRootDeploymentRunLoader {
    /* STATIC */
    public static get DEFAULT(): IManifestDeploymentRun {
        return {
            enabled: true,
            latest: false,
        };
    }

    public static check(devel: Partial<IManifestDeploymentRun>={}): IManifestDeploymentRun {
        const data = this.DEFAULT;
        if (devel.enabled!=undefined) {
            data.enabled = devel.enabled;
        }
        if (devel.enabled != undefined) {
            data.enabled = devel.enabled;
        }

        return data;
    }

    /* INSTANCE */
}
