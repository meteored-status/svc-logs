import {Value} from "./value/value";
import type {TParams} from "../index";
import {Translation} from "./index";

export class Literal<T extends TParams={}> extends Translation<T> {
    /* STATIC */

    /* INSTANCE */
    public constructor(private readonly _value: Value) {
        super();
    }

    public render(params?: Partial<T>): string {
        return this._value.value(params);
    }

}
