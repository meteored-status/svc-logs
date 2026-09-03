/**
 * Editor: Bixus
 * Fecha: Thu, 03 Sep 2026 06:58:23 GMT
 * Hash: 72a28354183230e2b888de6852f09552
 * Versión: 2026.9.3+1-bixus
 * Anterior: 2026.6.17+7-josantoniojimnez
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

import {Translation} from ".";
import {TParams, Value} from "./value/value";

export class TranslationSet<T extends TParams={}> extends Translation<T> {
    /* STATIC */

    /* INSTANCE */
    public constructor(protected readonly values: Value[]) {
        super();
    }

    public get(idx: number, params?: Partial<T>): string {
        const value = this.values[idx];
        return value.value(params);
    }

    public get size(): number {
        return this.values.length;
    }

    /**
     * Si el conjunto contiene un texto.
     *
     * @param item        - Texto a buscar.
     * @param params      - Sustitución de parámetros, para comparar contra el texto ya resuelto.
     * @param ignoreMayus - Compara sin distinguir mayúsculas. Normaliza **los dos lados**: antes solo pasaba
     *                      a minúsculas el valor guardado, así que la bandera convertía un acierto en fallo
     *                      salvo que quien llamaba trajera ya el texto en minúsculas.
     */
    public has(item: string, params?: Partial<T>, ignoreMayus: boolean = false): boolean {
        const buscado = ignoreMayus ? item.toLowerCase() : item;
        return this.values.some(value => {
            const actual = value.value(params);
            return (ignoreMayus ? actual.toLowerCase() : actual) === buscado;
        });
    }

    public forEach(callbackfn: (value: Value, value2: Value) => void, thisArg?: any): void {
        this.values.forEach(v => callbackfn.call(thisArg, v, v));
    }

    public allValues(params?: Partial<T>) {
        return this.values.map( v => v.value(params));
    }
}
