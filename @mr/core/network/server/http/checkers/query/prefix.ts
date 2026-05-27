import {type IQuery, Query} from ".";

/**
 * Valida que el valor del parámetro comience con un prefijo determinado.
 * Corresponde al criterio `prefix` de {@link IQuery}.
 */
export class Prefix extends Query {
    /**
     * @param key    - Nombre del parámetro de query string.
     * @param obj    - Criterios y opciones del parámetro.
     * @param prefix - Prefijo con el que debe comenzar el valor.
     */
    public constructor(key: string, obj: IQuery, private readonly prefix: string) {
        super(key, obj);
    }

    protected checkEjecutar(param: string): boolean {
        return param.startsWith(this.prefix);
    }
}

