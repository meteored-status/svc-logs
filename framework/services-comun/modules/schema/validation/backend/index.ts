import {warning} from "../../../utiles/log";
import {Conexion} from "../../../net/conexion";
import {JSONSchema, SchemaDescriptor} from "../../index";

export const validate = <T=any>(): Function => {
    return function (_target: Object | Function, _propertyKey: string, _descriptor: SchemaDescriptor<T>): void {
        const schema = _descriptor.schema;
        const originalMethod = _descriptor.value;

        if (!schema) {
            warning(`@validate used without @schema on method ${_propertyKey}`);
            return;
        }

        _descriptor.value = async function (this: any, ...args: any[]): Promise<any> {
            let connection = args.find(arg => arg instanceof Conexion);

            if (connection) {
                let errors: string[] = [];
                if (connection.metodo === 'POST') {
                    const postData = connection.post as T;
                    const type = connection.getHeaders()["content-type"]?.toLowerCase()??"";
                    const isMultipart = type.includes("multipart");

                    // Aquí podrías implementar la lógica de validación real
                    errors = validateObject<T>(postData, schema, isMultipart);

                }/* else if (connection.metodo === 'GET') {
                    const queryData = connection.query as T;
                    errors = validateObject<T>(queryData, schema);
                }*/

                if (errors.length) {
                    return connection.error(400, 'Bad Request');
                }
            }
            return await originalMethod.apply(this, args);
        }
    }
}

const validateObject = <T>(obj: T, schema: JSONSchema<T>, isMultipart: boolean = false): string[] => {
    const errors: string[] = [];

    for (const key in schema) {
        const validator = schema[key];
        const value = obj[key];

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

    return errors;
}
