import {type IQuery, Query} from ".";

/**
 * Valida que el valor del parámetro tenga una longitud mínima.
 * Acepta cualquier cadena siempre que su número de caracteres sea
 * mayor o igual al umbral indicado.
 * Corresponde al criterio `cualquiera` de {@link IQuery}.
 */
export class Cualquiera extends Query {
    /**
     * @param key      - Nombre del parámetro de query string.
     * @param obj      - Criterios y opciones del parámetro.
     * @param longitud - Longitud mínima en caracteres que debe tener el valor.
     */
    public constructor(key: string, obj: IQuery, private readonly longitud: number) {
        super(key, obj);
    }

    protected checkEjecutar(param: string): boolean {
        return param.length >= this.longitud;
    }
}

