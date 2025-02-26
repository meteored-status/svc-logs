import {type IManifestDeployment, ManifestDeployment} from "./deploy";
import {ManifestRoot} from "..";

export interface IManifest {
    deploy: IManifestDeployment;
}

export class Manifest extends ManifestRoot<IManifest> implements IManifest {
    /* STATIC */

    /* INSTANCE */
    public deploy: ManifestDeployment;

    public constructor(manifest: IManifest) {
        super();

        this.deploy = ManifestDeployment.build(manifest.deploy);
    }

    public toJSON(): IManifest {
        return {
            deploy: this.deploy.toJSON(),
        };
    }
}
