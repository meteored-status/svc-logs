import {Checker, type IExpresion} from ".";

/**
 * Checker que valida la URL por coincidencia exacta con un path predefinido.
 * Devuelve un array vacío (sin grupos de captura) si hay coincidencia.
 */
export class Exact extends Checker {
    /** Path exacto que debe coincidir con la URL entrante. */
    private readonly file: string;

    /**
     * @param obj  - Criterios y opciones de la expresión.
     * @param file - Path exacto que debe coincidir.
     */
    public constructor(obj: IExpresion, file: string) {
        super(obj);

        this.file = file;
    }

    protected checkEjecutar(url: string): string[] | null {
        return this.file === url ? [] : null;
    }
}
