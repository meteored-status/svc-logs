import {type IQuery, Query} from ".";

/**
 * Valida que el valor del parámetro pertenezca a un conjunto cerrado de cadenas permitidas.
 * Corresponde al criterio `options` de {@link IQuery}.
 */
export class Options extends Query {
    /**
     * @param key     - Nombre del parámetro de query string.
     * @param obj     - Criterios y opciones del parámetro.
     * @param options - Lista de valores permitidos.
     */
    public constructor(key: string, obj: IQuery, private readonly options: string[]) {
        super(key, obj);
    }

    protected checkEjecutar(param: string): boolean {
        return this.options.includes(param);
    }
}

