type RequiredFlag<T> = undefined extends T ? false : true;

type StringSchema<T> = {
    type: 'string';
    required: RequiredFlag<T>;
    regexp?: RegExp;
}

type NumberSchema<T> = {
    type: 'number';
    required: RequiredFlag<T>;
}

export type JSONSchema<T> = {
    [P in keyof T]:
    Extract<T[P], string> extends never
        ? Extract<T[P], number> extends never
            ? { type: 'other', required: undefined extends T[P] ? false : true  }
            : NumberSchema<T[P]>
        : StringSchema<T[P]>;
}

export type SchemaDescriptor<T> = PropertyDescriptor & {
    schema?: JSONSchema<T>;
}


export const schema = <T>(schema: JSONSchema<T>): Function => {
    return function (_target: Object | Function, _propertyKey: string, _descriptor: SchemaDescriptor<T>): SchemaDescriptor<T> {
        const originalMethod = _descriptor.value;

        _descriptor.schema = schema;
        _descriptor.value = function (...args: any[]) {
            return originalMethod.apply(this, args);
        }

        return _descriptor;
    }
}
