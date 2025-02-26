import {type IManifestBuildBundleBase, ManifestBuildBundleBase} from "./base";

export interface IManifestBuildBundle extends IManifestBuildBundleBase {
    web?: IManifestBuildBundleBase|IManifestBuildBundleBase[];
}

export class ManifestBuildBundle extends ManifestBuildBundleBase implements IManifestBuildBundle {
    /* STATIC */
    public static override build(bundle?: IManifestBuildBundle): ManifestBuildBundle {
        if (bundle==undefined) {
            return new this({});
        }

        return new this(bundle);
    }

    /* INSTANCE */
    public web: ManifestBuildBundleBase[];

    protected constructor(bundle: IManifestBuildBundle) {
        super(bundle);

        if (bundle.web!=undefined) {
            if (!Array.isArray(bundle.web)) {
                bundle.web = [bundle.web];
            }
            this.web = bundle.web
                .map((b) => ManifestBuildBundleBase.build(b))
                .filter((b) => b!=undefined);
        } else {
            this.web = [];
        }
    }

    public override toJSON(): IManifestBuildBundle|undefined {
        const padre = super.toJSON() ?? {};
        const web = this.web?.map((b) => b.toJSON()).filter((b) => b!=undefined) ?? [];
        const salida = {
            ...padre,
            web: web.length>0?
                web:
                undefined,
        };

        if (web.length==0 && Object.keys(padre).length==0) {
            return;
        }

        return salida;
    }
}
