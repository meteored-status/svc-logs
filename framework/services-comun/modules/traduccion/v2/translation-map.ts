import {Translation} from "./index";
import {TParams, Value} from "./value/value";
import {TranslationMapInterface} from "./interfaces/collection";

export interface ITranslationMapKeys {
    [key: string]: string|undefined;
}

export type ITranslationMapValues<K extends ITranslationMapKeys> = Record<keyof K, Value>;

export type MapExport<K extends ITranslationMapKeys = ITranslationMapKeys, T extends TParams = {}> =
    ((key: keyof K, params?: Partial<T>) => string) & {
    size?: number;
    map: () => TranslationMap<K, T>;
    valor?: string;
};


export class TranslationMap<K extends ITranslationMapKeys=ITranslationMapKeys, T extends TParams={}> extends Translation<T>
            implements TranslationMapInterface<K, T>{
    /* STATIC */

    /* INSTANCE */
    public constructor(protected readonly values_: ITranslationMapValues<K>) {
        super();
    }

    public render(key: keyof K, params?: Partial<T>): string {
        const value = this.values_[key];
        return value.value(params);
    }

    public get size(): number{
        return Object.keys(this.values_).length;
    }

    public values(params?: Partial<T>){
        return Object.values(this.values_).map(v => v.value(params));
    }

    public keys(){
        return Object.keys(this.values_);
    }

    public orderValues(order: string[],params?: Partial<T>): string[] {
        return order.map( c => this.render(c, params));
    }
}
