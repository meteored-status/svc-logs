/**
 * Editor: José Antonio Jiménez
 * Fecha: Wed, 17 Jun 2026 13:19:31 GMT
 * Hash: edfd35776b2218c3230384be9b9fb30b
 * Versión: 2026.6.17+7-josantoniojimnez
 * Anterior: 2026.6.17+6-juancmartinez
 */

import {TParams, Value} from "./value";
import {TPluralKey} from ".";

export type TPluralFunction = (i: number) => TPluralKey;

export class PluralValue<T extends TParams={}> extends Value<T> {
    /* STATIC */

    /* INSTANCE */
    public constructor(
        protected readonly _value: Partial<Record<TPluralKey, string>>,
        protected readonly _rules: TPluralFunction,
        params?: string[]) {
        super(params ?? []);
    }

    public override value(params?: Partial<T>) {
        let key: TPluralKey;

        if (this.paramsLength == 1) {
            key = this._rules(Number(params?.[this.params[0]]));
        } else {
            key = this._rules(0);
        }

        const value = this._value[key];
        if (!value) {
            throw new Error(`Missing plural value for key "${key}"`);
        }
        return this.applyParams(value, params);
    }
}
