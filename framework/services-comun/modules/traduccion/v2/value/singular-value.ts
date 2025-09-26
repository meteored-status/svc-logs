import {TParams, Value} from "./value";


export class SingularValue<T extends TParams={}> extends Value<T> {
    /* STATIC */

    /* INSTANCE */
    public constructor(protected readonly _value: string, params?: string[]) {
        super(params ?? []);
    }

    public override value(params?: Partial<T>): string {
        return this.applyParams(this._value, params)
    }
}
