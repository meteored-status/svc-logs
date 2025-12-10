type PrimitiveType = 'string' | 'number' | 'boolean';
type PostType = 'body' | 'path';

type BaseField = {
    required: boolean;
    description: string;
    regexp?: RegExp;
    postType?: PostType;
}

type PrimitiveField = BaseField & {
    type: PrimitiveType;
}

type ArrayField = BaseField & {
    type: 'array';
    items: FieldDefinition;
}

type ObjectField = BaseField & {
    type: 'object';
    properties: {
        [key: string]: FieldDefinition;
    };
}

export type FieldDefinition = PrimitiveField | ArrayField | ObjectField;

export type CustomSpecification = {
    [key: string]: FieldDefinition;
}

export const buildSpecification = <const T extends CustomSpecification>(spec: T): T => {
    return spec;
}
