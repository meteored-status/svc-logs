/** Tipos primitivos soportados en las especificaciones de campo. */
type PrimitiveType = 'string' | 'number' | 'boolean';

/**
 * Origen del campo en una petición HTTP.
 * - `body` — el valor proviene del cuerpo de la petición.
 * - `path` — el valor proviene de un segmento de la URL.
 */
type PostType = 'body' | 'path';

/**
 * Atributos comunes a todos los tipos de campo de una especificación.
 *
 * @property required     - Si `true`, el campo es obligatorio en la petición/respuesta.
 * @property description  - Descripción del campo para la documentación generada.
 * @property regexp       - Expresión regular opcional para validar el valor del campo.
 * @property postType     - Indica si el campo proviene del cuerpo o de la URL.
 */
type BaseField = {
    required: boolean;
    description: string;
    regexp?: RegExp;
    postType?: PostType;
};

/**
 * Campo de tipo primitivo (`string`, `number` o `boolean`).
 *
 * @property type - Tipo primitivo del campo.
 */
type PrimitiveField = BaseField & {
    type: PrimitiveType;
};

/**
 * Campo de tipo array. Los elementos son a su vez definiciones de campo,
 * lo que permite arrays homogéneos de cualquier tipo soportado.
 *
 * @property type  - Siempre `'array'`.
 * @property items - Definición del tipo de cada elemento del array.
 */
type ArrayField = BaseField & {
    type: 'array';
    items: FieldDefinition;
};

/**
 * Campo de tipo objeto con propiedades tipadas.
 * Permite anidar especificaciones de forma recursiva.
 *
 * @property type       - Siempre `'object'`.
 * @property properties - Mapa de propiedades del objeto, cada una con su propia {@link FieldDefinition}.
 */
type ObjectField = BaseField & {
    type: 'object';
    properties: CustomSpecification;
};

/**
 * Unión discriminada de todos los tipos de campo soportados.
 * El discriminante es la propiedad `type`.
 */
export type FieldDefinition = PrimitiveField | ArrayField | ObjectField;

/**
 * Especificación de un esquema: mapa de nombre de campo a su {@link FieldDefinition}.
 * Se usa como tipo base para describir el cuerpo de una petición, respuesta o headers.
 */
export type CustomSpecification = {
    [key: string]: FieldDefinition;
};

/**
 * Helper de construcción de especificaciones con inferencia `as const`.
 * Preserva los tipos literales de `type`, `required`, etc., lo que permite a
 * {@link SchemedType} derivar el tipo TypeScript exacto de la especificación.
 *
 * @param spec - Especificación de esquema a construir.
 * @returns La misma especificación, con tipos literales preservados.
 */
export const buildSpecification = <const T extends CustomSpecification>(spec: T): T => {
    return spec;
};
