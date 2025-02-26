import {type IManifestDeploymentBuild, ManifestDeploymentBuild} from "./build";
import {type IManifestDeploymentRun, ManifestDeploymentRun} from "./run";

export interface IManifestDeployment {
    build: IManifestDeploymentBuild;
    run: IManifestDeploymentRun;
}

export class ManifestDeployment implements IManifestDeployment {
    /* STATIC */
    public static build(deploy: IManifestDeployment): ManifestDeployment {
        return new this(deploy);
    }

    /* INSTANCE */
    public build: ManifestDeploymentBuild;
    public run: ManifestDeploymentRun;

    protected constructor(deploy: IManifestDeployment) {
        this.build = ManifestDeploymentBuild.build(deploy.build);
        this.run = ManifestDeploymentRun.build(deploy.run);
    }

    public toJSON(): IManifestDeployment {
        return {
            build: this.build.toJSON(),
            run: this.run.toJSON(),
        };
    }
}
