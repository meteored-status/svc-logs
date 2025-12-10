import {Conexion} from "../../../conexion";
import {error} from "../../../../utiles/log";
import {CustomSpecification} from "../../spec";

export const validate = <T extends CustomSpecification>(schema: T): Function => {
    return function (_target: Object | Function, _propertyKey: string, _descriptor: PropertyDescriptor): void {
        const originalMethod = _descriptor.value;
        _descriptor.value = async function (this: any, ...args: any[]): Promise<any> {
            let connection = args.find(arg => arg instanceof Conexion);

            if (connection) {
                let errors: string[] = [];
                if (connection.metodo === 'POST') {
                    const postData = connection.post as T;
                    const type = connection.getHeaders()["content-type"]?.toLowerCase()??"";
                    const isMultipart = type.includes("multipart");

                    Object.entries(schema).forEach(([_, value]) => {
                        value.required = value.required ?? false;
                    })

                    // Aquí podrías implementar la lógica de validación real
                    errors = validateObject<T>(postData, schema, isMultipart);
                }

                if (errors.length) {
                    error(`Validation errors: ${errors.join(', ')}`);
                    return connection.error(400, 'Bad Request');
                }
            }
            return await originalMethod.apply(this, args);
        }
    }
}



const validateObject = <T extends CustomSpecification>(obj: unknown, schema: T, isMultipart: boolean = false): string[] => {
    const errors: string[] = [];

    if (typeof obj !== 'object' || obj === null) {
        errors.push('El objeto a validar debe ser un objeto válido.');
    } else {
        for (const key in schema) {
            const validator = schema[key];
            const value = (obj as any)[key];

            if (validator.required === true && (value === null || value === undefined)) {
                errors.push(`El campo ${key} es obligatorio.`);
            } else if (validator.required === true) {
                if (validator.type === 'string' && typeof value !== 'string') {
                    errors.push(`El campo ${key} debe ser una cadena.`);
                } else if (validator.type === 'number' && typeof value !== 'number' && (!isMultipart || (isMultipart && typeof value !== 'string'))) {
                    errors.push(`El campo ${key} debe ser un número.`);
                } else if (validator.type === 'string' && validator.regexp !== undefined && typeof value === 'string' && !validator.regexp.test(value)) {
                    errors.push(`El campo ${key} no cumple el formato requerido.`);
                }
            } else {
                if (value !== null && value !== undefined) {
                    if (validator.type === 'string' && typeof value !== 'string') {
                        errors.push(`El campo ${key} debe ser una cadena.`);
                    } else if (validator.type === 'number' && typeof value !== 'number' && (!isMultipart || (isMultipart && typeof value !== 'string'))) {
                        errors.push(`El campo ${key} debe ser un número.`);
                    } else if (validator.type === 'string' && validator.regexp !== undefined && typeof value === 'string' && !validator.regexp.test(value)) {
                        errors.push(`El campo ${key} no cumple el formato requerido.`);
                    }
                }
            }
        }
    }

    return errors;
}
