import {TParams, Value} from "./value";
import {TPluralKey} from "./index";

export class PluralValue<T extends TParams={}> extends Value<T> {
    /* STATIC */

    /* INSTANCE */
    public constructor(
        protected readonly _value: Partial<Record<TPluralKey, string>>,
        protected readonly _rules: (n: number) => TPluralKey,
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
