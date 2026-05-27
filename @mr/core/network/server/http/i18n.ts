import type {Idioma as TIdioma, IdiomaCorto} from "@mr/core-i18n/langs";

/**
 * Configuración global de idiomas del servicio.
 *
 * @property idiomas  - Lista de idiomas soportados por el servicio.
 * @property defecto  - Idioma que se usa cuando ninguno de los soportados coincide con la petición.
 * @property enabled  - Si `false`, la detección de idioma está deshabilitada y siempre se usa `defecto`.
 */
export interface IIdiomas {
    idiomas: TIdioma[];
    defecto: TIdioma;
    enabled: boolean;
}

/**
 * Idioma resuelto para una petición concreta.
 *
 * @property idioma        - Código de idioma largo detectado para la petición (p. ej. `"es-ES"`).
 * @property defecto       - Idioma por defecto del servicio.
 * @property idioma_corto  - Código corto ISO 639-1 del idioma detectado (p. ej. `"es"`).
 * @property defecto_corto - Código corto ISO 639-1 del idioma por defecto.
 */
export interface IIdioma {
    idioma: TIdioma;
    defecto: TIdioma;
    idioma_corto: IdiomaCorto;
    defecto_corto: IdiomaCorto;
}

/**
 * Resuelve el idioma de una petición HTTP a partir del path de la URL.
 *
 * ### Detección automática
 * Si `enabled` es `true`, se extrae el segmento inicial del path (p. ej. `/es/ruta` → `"es"`)
 * y se comprueba si pertenece a la lista de idiomas soportados. Si coincide, el segmento se
 * elimina del path para que el resto del sistema reciba la URL sin prefijo de idioma.
 * Si no coincide o `enabled` es `false`, se usa el idioma por defecto.
 *
 * ### Uso
 * ```ts
 * Idioma.inicializar({ idiomas: ["es", "en"], defecto: "en", enabled: true });
 * const idioma = Idioma.build("/es/inicio");
 * // idioma.idioma      → "es"
 * // idioma.path        → "/inicio"
 * ```
 */
export class Idioma implements IIdioma {

    /** Configuración global de idiomas, compartida por todas las instancias. */
    private static INICIAL: IIdiomas = {
        idiomas: [],
        defecto: "en",
        enabled: false,
    };

    /**
     * Establece la configuración global de idiomas. Debe llamarse una sola vez
     * durante el arranque del servicio, antes de cualquier llamada a {@link build}.
     * El objeto se congela para evitar mutaciones accidentales.
     * @param inicial - Configuración de idiomas del servicio.
     */
    public static inicializar(inicial: IIdiomas): void {
        this.INICIAL = Object.freeze(inicial);
    }

    /**
     * Construye una instancia de {@link Idioma} detectando el idioma a partir del path.
     * @param path - Path de la URL entrante (con query string excluida).
     * @returns Nueva instancia con el idioma detectado y el path normalizado.
     */
    public static build(path: string): Idioma {
        return new this(this.INICIAL, path);
    }


    /** Configuración global de idiomas usada para la detección. */
    private readonly data: IIdiomas;

    /** Path normalizado de la URL (sin el prefijo de idioma si fue detectado). */
    public path: string;

    /** Código de idioma largo detectado para esta petición. */
    public idioma: TIdioma;

    /** Código corto ISO 639-1 del idioma detectado. */
    public idioma_corto: IdiomaCorto;

    /** Código corto ISO 639-1 del idioma por defecto del servicio. */
    public defecto_corto: IdiomaCorto;

    /** Lista de idiomas soportados por el servicio. */
    public get idiomas(): TIdioma[] { return this.data.idiomas; }

    /** Idioma por defecto del servicio. */
    public get defecto(): TIdioma   { return this.data.defecto; }

    /** Si `true`, la detección de idioma está activa. */
    public get enabled(): boolean   { return this.data.enabled; }

    protected constructor(data: IIdiomas, path: string) {
        this.data = data;
        this.path = path;
        this.idioma = this.detectar();
        if (this.idioma !== this.data.defecto) {
            this.path = this.path.slice(this.idioma.length + 1);
        }
        this.idioma_corto = this.idioma.slice(0, 2) as IdiomaCorto;
        this.defecto_corto = this.data.defecto.slice(0, 2) as IdiomaCorto;
    }

    /**
     * Extrae y valida el segmento de idioma del path de la URL.
     * @returns Código de idioma detectado, o el idioma por defecto si no se reconoce.
     */
    private detectar(): TIdioma {
        if (!this.data.enabled) {
            return this.data.defecto;
        }

        const slashIndex = this.path.indexOf("/", 1);
        const lang = this.path.slice(1, slashIndex) as TIdioma;

        if (!this.data.idiomas.includes(lang)) {
            return this.data.defecto;
        }

        return lang;
    }

    /**
     * Genera el path completo para un idioma dado, añadiendo el prefijo de idioma
     * cuando es distinto del idioma por defecto del servicio.
     *
     * @param path   - Path base sin prefijo de idioma (p. ej. `"/inicio"`).
     * @param idioma - Idioma para el que generar el path. Por defecto el idioma detectado.
     * @returns Path con prefijo de idioma si aplica (p. ej. `"/fr/inicio"`),
     *   o el path original si el idioma coincide con el defecto.
     */
    public generar(path: string, idioma: string = this.idioma): string {
        if (idioma === this.data.defecto) {
            return path;
        }

        return `/${idioma}${path}`;
    }
}
