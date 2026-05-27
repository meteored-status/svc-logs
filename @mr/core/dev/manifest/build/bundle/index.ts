/**
 * Editor: José Antonio Jiménez
 * Fecha: Thu, 21 May 2026 06:51:30 GMT
 * Hash: 4a01112a235ee335e0e882f000cacfa3
 * Versión: 2026.5.21+1-josantoniojimnez
 */

import {type IManifestBuildBundleBase, ManifestBuildBundleBase} from "./base.ts";

/**
 * Configuración completa del bundle de assets de un workspace.
 * Extiende {@link IManifestBuildBundleBase} con soporte para bundles web adicionales.
 *
 * @property web - Uno o varios bundles web adicionales (p. ej. componentes embebibles).
 *   Puede ser un objeto único o un array. Por defecto `[]`.
 */
export interface IManifestBuildBundle extends IManifestBuildBundleBase {
    web?: IManifestBuildBundleBase|IManifestBuildBundleBase[];
}

/**
 * Modelo de la sección `build.bundle` de `mrpack.json`.
 *
 * El bundle principal hereda la configuración de {@link ManifestBuildBundleBase}.
 * Los bundles web adicionales se normalizan siempre a un array de {@link ManifestBuildBundleBase}.
 */
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
