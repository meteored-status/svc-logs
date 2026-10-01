/**
 * Editor: Bixus
 * Fecha: Wed, 23 Sep 2026 08:46:25 GMT
 * Hash: 24781999c51355683c445e3aacff3f04
 * Versión: 2026.9.23+1-bixus
 * Anterior: 2026.9.18+1-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

import {Translation} from ".";
import type {TParams, Value} from "./value/value";

type MapKey = string | number;

export type ITranslationMapValues<K extends MapKey> = Record<K, Value>;

export class TranslationMap<K extends MapKey, T extends TParams={}> extends Translation<T> {
    /* INSTANCE */
    public constructor(protected readonly _values: ITranslationMapValues<K>) {
        super();
    }

    /**
     * Get a value from the map.
     * If the key is not found, it returns the key itself as a string.
     * @param key Key to get.
     * @param params Parameter substitution.
     */
    public get(key: K, params?: Partial<T>): string {
        const value = this._values[key];
        return value?.value(params)??`${key}`;
    }

    /**
     * Unsafe Get.
     * Like #get metdhod but whitout type cheking.
     * @param key Key to get.
     * @param params Parameter substitution.
     */
    public uGet(key: string|number, params?: Partial<T>): string {
        let validKey: K;
        if (typeof key === 'number') {
            validKey = `${key}` as K;
        } else {
            validKey = key as K;
        }
        return this.get(validKey, params);
    }

    public get size(): number{
        return Object.keys(this._values).length;
    }

    public values(params?: Partial<T>){
        return Object.values(this._values).map(v => (v as Value).value(params));
    }

    public keys(){
        return Object.keys(this._values);
    }

    public orderValues(order: K[], params?: Partial<T>): string[] {
        return order.map(c => this.get(c, params));
    }
}
