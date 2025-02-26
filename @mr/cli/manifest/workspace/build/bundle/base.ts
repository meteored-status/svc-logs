import {type IManifestBuildComponentes, ManifestBuildComponentes} from "./componentes";

export interface IManifestBuildBundleBase {
    componentes?: Partial<IManifestBuildComponentes>;
    entries?: Record<string, string>;
    prefix?: string;
    source_map?: string[];
}

export class ManifestBuildBundleBase implements IManifestBuildBundleBase {
    /* STATIC */
    public static build(bundle?: IManifestBuildBundleBase): ManifestBuildBundleBase|undefined {
        if (bundle==undefined) {
            return;
        }

        return new this(bundle);
    }

    /* INSTANCE */
    public componentes: ManifestBuildComponentes;
    public entries?: Record<string, string>;
    public prefix?: string;
    public source_map?: string[];

    protected constructor(bundle: IManifestBuildBundleBase) {
        this.componentes = ManifestBuildComponentes.build(bundle.componentes);
        this.entries = bundle.entries;
        this.prefix = bundle.prefix;
        this.source_map = bundle.source_map;
    }

    public toJSON(): Partial<IManifestBuildBundleBase>|undefined {
        const salida: Partial<IManifestBuildBundleBase> = {};
        const componentes = this.componentes.toJSON();
        if (componentes!=undefined) {
            salida.componentes = componentes;
        }
        if (this.entries!=undefined) {
            salida.entries = this.entries;
        }
        if (this.prefix!=undefined) {
            salida.prefix = this.prefix;
        }
        if (this.source_map!=undefined) {
            salida.source_map = this.source_map;
        }
        if (Object.keys(salida).length==0) {
            return;
        }
        return salida;
    }
}
