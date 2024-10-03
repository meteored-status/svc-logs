import {Idioma as TIdioma, IdiomaCorto} from ".";

export interface IIdiomas {
    idiomas: TIdioma[];
    defecto: TIdioma;
    enabled: boolean;
}

export interface IIdioma {
    idioma: TIdioma;
    defecto: TIdioma;
    idioma_corto: IdiomaCorto;
    defecto_corto: IdiomaCorto;
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
    public get idiomas(): TIdioma[] { return this.data.idiomas; };
    public get defecto(): TIdioma   { return this.data.defecto; };
    public get enabled(): boolean  { return this.data.enabled; };

    public idioma: TIdioma;
    public idioma_corto: IdiomaCorto;
    public defecto_corto: IdiomaCorto;

    protected constructor(private data: IIdiomas, public path: string) {
        this.idioma = this.detectar();
        if (this.idioma!=this.data.defecto) {
            this.path = this.path.substring(this.idioma.length+1);
        }
        this.idioma_corto = this.idioma.substring(0, 2) as IdiomaCorto;
        this.defecto_corto = this.data.defecto.substring(0, 2) as IdiomaCorto;
    }

    private detectar(): TIdioma {
        if (!this.data.enabled) {
            return this.data.defecto;
        }

        const i = this.path.indexOf("/", 1);
        const lang = this.path.substring(1, i) as TIdioma;

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
