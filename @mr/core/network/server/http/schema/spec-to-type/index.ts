import type {CustomSpecification, FieldDefinition} from "../spec";

/**
 * Tabla de correspondencia entre los nombres de tipo primitivo de {@link FieldDefinition}
 * y sus equivalentes TypeScript. Usada por {@link ResolveType} para la resolución.
 */
type TypeMap = {
    string: string;
    number: number;
    boolean: boolean;
};

/**
 * Utilitario que aplana tipos de intersección para mejorar la legibilidad en el IDE.
 * Transforma `{ a: string } & { b: number }` en `{ a: string; b: number }`.
 *
 * @template T - Tipo a aplanar.
 */
type Prettify<T> = {
    [K in keyof T]: T[K];
} & {};

/**
 * Resuelve el tipo TypeScript correspondiente a una {@link FieldDefinition}.
 *
 * - Si `T` es un campo `array`, devuelve `Array<ResolveType<T['items']>>` (recursivo).
 * - Si `T` es un campo `object`, devuelve {@link SchemedType} de sus propiedades (recursivo).
 * - Si `T` es un campo primitivo, devuelve el tipo TypeScript via {@link TypeMap}.
 * - En cualquier otro caso, devuelve `never`.
 *
 * @template T - Definición de campo a resolver.
 */
export type ResolveType<T extends FieldDefinition> =
    T extends { type: 'array' }
        ? Array<ResolveType<T['items']>>
        : T extends { type: 'object' }
            ? SchemedType<T['properties']>
            : T extends { type: keyof TypeMap }
                ? TypeMap[T['type']]
                : never;

/**
 * Deriva el tipo TypeScript de un objeto a partir de una {@link CustomSpecification}.
 *
 * Separa los campos en dos grupos mediante mapped types:
 * - Campos con `required: true` → propiedades **obligatorias**.
 * - Campos con `required: false` → propiedades **opcionales** (`?`).
 *
 * El resultado se aplana con {@link Prettify} para que el IDE muestre el tipo
 * final como un objeto plano en lugar de una intersección.
 *
 * ### Ejemplo
 * ```ts
 * const spec = buildSpecification({
 *     name:  { type: 'string',  required: true,  description: 'Nombre' },
 *     email: { type: 'string',  required: false, description: 'Email' },
 * });
 * type T = SchemedType<typeof spec>;
 * // → { name: string; email?: string }
 * ```
 *
 * @template T - Especificación de esquema de la que derivar el tipo.
 */
export type SchemedType<T extends CustomSpecification> = Prettify<
    { [K in keyof T as T[K]['required'] extends true ? K : never]: ResolveType<T[K]> } &
    { [K in keyof T as T[K]['required'] extends false ? K : never]?: ResolveType<T[K]> }
>;
