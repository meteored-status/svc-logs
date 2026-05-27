import {type IQuery, Query} from ".";

/**
 * Valida que el valor del parámetro coincida con una expresión regular.
 * Corresponde al criterio `regex` de {@link IQuery}.
 */
export class Regex extends Query {
    /**
     * @param key   - Nombre del parámetro de query string.
     * @param obj   - Criterios y opciones del parámetro.
     * @param regex - Expresión regular que debe producir al menos una coincidencia en el valor.
     *   Si el regex tiene los flags `g` o `y`, `lastIndex` se resetea antes de cada validación
     *   para evitar resultados incorrectos en llamadas consecutivas.
     */
    public constructor(key: string, obj: IQuery, private readonly regex: RegExp) {
        super(key, obj);
    }

    protected checkEjecutar(param: string): boolean {
        this.regex.lastIndex = 0;
        return this.regex.test(param);
    }
}

