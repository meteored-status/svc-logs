import {Checker, type IExpresion} from ".";

/**
 * Checker que valida la URL por prefijo.
 * Si la URL comienza por el prefijo configurado, devuelve el resto del path
 * (la parte posterior al prefijo) como único elemento del array de grupos.
 */
export class Prefix extends Checker {
    /** Prefijo que debe tener la URL. */
    private readonly prefix: string;

    /** Longitud del prefijo, precalculada para evitar llamadas repetidas a `.length`. */
    private readonly length: number;

    /**
     * @param obj    - Criterios y opciones de la expresión.
     * @param prefix - Prefijo que debe tener la URL entrante.
     */
    public constructor(obj: IExpresion, prefix: string) {
        super(obj);

        this.prefix = prefix;
        this.length = prefix.length;
    }

    protected checkEjecutar(url: string): string[] | null {
        return url.startsWith(this.prefix) ? [url.slice(this.length)] : null;
    }
}
