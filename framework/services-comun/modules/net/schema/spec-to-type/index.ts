import {CustomSpecification, FieldDefinition} from "../spec";

type TypeMap = {
    string: string;
    number: number;
    boolean: boolean;
};

type Prettify<T> = {
    [K in keyof T]: T[K];
} & {};

export type ResolveType<T extends FieldDefinition> =
    T extends { type: 'array' }
        ? Array<ResolveType<T['items']>>
        : T extends { type: 'object' }
            ? SchemedType<T['properties']>
            : T extends { type: keyof TypeMap }
                ? TypeMap[T['type']]
                : never;

export type SchemedType<T extends CustomSpecification> = Prettify<
    { [K in keyof T as T[K]['required'] extends true ? K : never]: ResolveType<T[K]> } &
    { [K in keyof T as T[K]['required'] extends false ? K : never]?: ResolveType<T[K]> }
>;
