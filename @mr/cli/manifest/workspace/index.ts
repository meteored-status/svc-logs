import {type IManifestDeployment, ManifestDeployment} from "./deployment";
import {type IManifestDevelopment, ManifestDevelopment} from "./development";
import {type IManifestBuild, ManifestBuild} from "./build";
import {ManifestRoot} from "..";

export interface IManifest {
    enabled: boolean;
    deploy: IManifestDeployment;
    devel: IManifestDevelopment;
    build: IManifestBuild;
}

export class Manifest extends ManifestRoot<IManifest> implements IManifest {
    /* STATIC */

    /* INSTANCE */
    public enabled: boolean;
    public deploy: ManifestDeployment;
    public devel: ManifestDevelopment;
    public build: ManifestBuild;

    public constructor(manifest: IManifest) {
        super();

        this.enabled = manifest.enabled;
        this.deploy = ManifestDeployment.build(manifest.deploy);
        this.devel = ManifestDevelopment.build(manifest.devel);
        this.build = ManifestBuild.build(manifest.build);
    }

    public toJSON(): IManifest {
        return {
            enabled: this.enabled,
            deploy: this.deploy.toJSON(),
            devel: this.devel.toJSON(),
            build: this.build.toJSON(),
        };
    }
}
