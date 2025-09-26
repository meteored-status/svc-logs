import {Translation} from "./index";
import {TParams, Value} from "./value/value";

export interface ITranslationMapKeys {
    [key: string]: string|undefined;
}

export type ITranslationMapValues<K extends ITranslationMapKeys> = Record<keyof K, Value>;

export class TranslationMap<K extends ITranslationMapKeys=ITranslationMapKeys, T extends TParams={}> extends Translation<T> {
    /* STATIC */

    /* INSTANCE */
    public constructor(protected readonly values: ITranslationMapValues<K>) {
        super();
    }

    public render(key: keyof K, params?: Partial<T>): string {
        const value = this.values[key];
        return value.value(params);
    }
}
