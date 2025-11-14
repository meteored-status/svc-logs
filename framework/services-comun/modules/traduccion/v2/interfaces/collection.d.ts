import {TParams, Value} from "../value/value";

interface TranslationMapInterface<K, V>{

    values(params?: Partial<T>): string[];

    keys(): string[];

    orderValues(order: string[],params?: Partial<T>): string[]

    readonly size: number;
}


interface TranslationSetInterface<T extends TParams={}> {

    get(idx:number, params?: Partial<T>): string

    has(item: string, params?: Partial<T>, ignoreMayus?: boolean): boolean

    forEach(callbackfn: (value: Value, value2: Value) => void, thisArg?: any): void;

    allValues(params?: Partial<T>): string[];

    readonly size: number;

}

