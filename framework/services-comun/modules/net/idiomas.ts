export interface IIdiomas {
    idiomas: string[];
    defecto: string;
    enabled: boolean;
}

export interface IIdioma {
    idioma: string;
    defecto: string;
    idioma_corto: string;
    defecto_corto: string;
}

export class Idioma implements IIdioma {
    /* STATIC */
    private static INICIAL: IIdiomas = {
        idiomas: [],
        defecto: "en",
        enabled: false,
    }

    public static inicializar(inicial: IIdiomas): void {
        this.INICIAL = Object.freeze(inicial);
    }

    public static build(path: string): Idioma {
        return new this(this.INICIAL, path);
    }

    /* INSTANCE */
    public get idiomas(): string[] { return this.data.idiomas; };
    public get defecto(): string   { return this.data.defecto; };
    public get enabled(): boolean  { return this.data.enabled; };

    public idioma: string;
    public idioma_corto: string;
    public defecto_corto: string;

    protected constructor(private data: IIdiomas, public path: string) {
        this.idioma = this.detectar();
        if (this.idioma!=this.data.defecto) {
            this.path = this.path.substring(this.idioma.length+1);
        }
        this.idioma_corto = this.idioma.substring(0, 2);
        this.defecto_corto = this.data.defecto.substring(0, 2);
    }

    private detectar(): string {
        if (!this.data.enabled) {
            return this.data.defecto;
        }

        const i = this.path.indexOf("/", 1);
        const lang = this.path.substring(1, i);

        if (this.data.idiomas.indexOf(lang)<0) {
            return this.data.defecto;
        }

        return lang;
    }

    public generar(path: string, idioma?: string): string {
        idioma = idioma??this.idioma;
        if (idioma==this.data.defecto) {
            return path;
        }

        return `/${idioma}${path}`;
    }
}
