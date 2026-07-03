/**
 * Editor: José Antonio Jiménez
 * Fecha: Wed, 17 Jun 2026 13:19:31 GMT
 * Hash: 3d47c0a43b67732c5537ac0ee7d9835c
 * Versión: 2026.6.17+7-josantoniojimnez
 */

import {Translation} from ".";
import {TParams, Value} from "./value/value";

type MapKey = string | number;

export type ITranslationMapValues<K extends MapKey> = Record<K, Value>;

export class TranslationMap<K extends MapKey, T extends TParams={}> extends Translation<T> {
    /* STATIC */

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
