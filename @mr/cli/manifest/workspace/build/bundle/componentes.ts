export const enum ManifestBuildComponentesCSS {
    DESACTIVADO = "",
    INYECTADO = "inyectado",
    INDEPENDIENTE = "independiente",
    CRITICAL = "critical",
}

export interface IManifestBuildComponentes {
    optimizar: boolean;
    pug: boolean;
    css: ManifestBuildComponentesCSS;
}

export class ManifestBuildComponentes implements IManifestBuildComponentes {
    /* STATIC */
    public static build(componentes: Partial<IManifestBuildComponentes> = {}): ManifestBuildComponentes {
        return new ManifestBuildComponentes(componentes);
    }

    /* INSTANCE */
    public optimizar: boolean;
    public pug: boolean;
    public css: ManifestBuildComponentesCSS;

    protected constructor(componentes: Partial<IManifestBuildComponentes>) {
        this.optimizar = componentes.optimizar ?? true;
        this.pug = componentes.pug ?? false;
        this.css = componentes.css ?? ManifestBuildComponentesCSS.DESACTIVADO;
    }

    public toJSON(): Partial<IManifestBuildComponentes>|undefined {
        const salida: Partial<IManifestBuildComponentes> = {};
        if (!this.optimizar) {
            salida.optimizar = false;
        }
        if (this.pug) {
            salida.pug = true;
        }
        if (this.css!=ManifestBuildComponentesCSS.DESACTIVADO) {
            salida.css = this.css;
        }
        if (Object.keys(salida).length==0) {
            return;
        }
        return salida;
    }
}
