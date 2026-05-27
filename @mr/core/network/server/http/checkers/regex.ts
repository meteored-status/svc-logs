import {Checker, type IExpresion} from ".";

/**
 * Checker que valida la URL mediante una expresión regular.
 * Devuelve los grupos de captura (índices 1…n) del primer match como array de strings.
 * El prefijo actúa como guardia rápida antes de aplicar la regex.
 */
export class Regex extends Checker {
    /** Prefijo que debe tener la URL antes de aplicar la expresión regular. Por defecto `"/"`. */
    private readonly prefix: string;

    /** Expresión regular utilizada para el matching de la URL. */
    private readonly regex: RegExp;

    /**
     * @param obj    - Criterios y opciones de la expresión.
     * @param regex  - Expresión regular que se aplica sobre la URL.
     * @param prefix - Prefijo obligatorio de la URL. Por defecto `"/"`.
     */
    public constructor(obj: IExpresion, regex: RegExp, prefix?: string) {
        super(obj);

        this.regex = regex;
        this.prefix = prefix ?? "/";
    }

    protected checkEjecutar(url: string): string[] | null {
        if (!url.startsWith(this.prefix)) {
            return null;
        }

        return url.match(this.regex)?.slice(1) ?? null;
    }
}
