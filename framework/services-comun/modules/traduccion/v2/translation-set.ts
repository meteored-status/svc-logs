import {Translation} from "./index";
import {TParams, Value} from "./value/value";

export class TranslationSet<T extends TParams={}> extends Translation<T> {
    /* STATIC */

    /* INSTANCE */
    public constructor(protected readonly values: Value[]) {
        super();
    }

    public render(idx: number, params?: Partial<T>): string {
        const value = this.values[idx];
        return value.value(params);
    }
}
