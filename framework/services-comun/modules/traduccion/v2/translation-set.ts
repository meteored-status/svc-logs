/**
 * Editor: José Antonio Jiménez
 * Fecha: Wed, 17 Jun 2026 13:19:31 GMT
 * Hash: ef645acdfa56e303e67dde8719ebbed1
 * Versión: 2026.6.17+7-josantoniojimnez
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

    public has(item: string, params?: Partial<T>, ignoreMayus: boolean = false): boolean {
        return this.values.some(value => (ignoreMayus ? value.value(params).toLowerCase() : value.value(params)) === item);
    }

    public forEach(callbackfn: (value: Value, value2: Value) => void, thisArg?: any): void {
        this.values.forEach(v => callbackfn.call(thisArg, v, v));
    }

    public allValues(params?: Partial<T>) {
        return this.values.map( v => v.value(params));
    }
}
