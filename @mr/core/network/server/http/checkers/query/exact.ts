import {type IQuery, Query} from ".";

/**
 * Valida que el valor del parámetro sea exactamente igual a una cadena dada.
 * Corresponde al criterio `exact` de {@link IQuery}.
 */
export class Exact extends Query {
    /**
     * @param key   - Nombre del parámetro de query string.
     * @param obj   - Criterios y opciones del parámetro.
     * @param param - Cadena exacta con la que debe coincidir el valor.
     */
    public constructor(key: string, obj: IQuery, private readonly param: string) {
        super(key, obj);
    }

    protected checkEjecutar(param: string): boolean {
        return this.param === param;
    }
}

