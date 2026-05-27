import {error} from "services-comun/modules/utiles/log";

import {Conexion} from "../../../conexion";
import type {CustomSpecification, FieldDefinition} from "../../spec";

/**
 * Decorador de método que valida el cuerpo de una petición `POST` contra un esquema
 * {@link CustomSpecification} antes de invocar al método original.
 *
 * Si la conexión es un `POST`, extrae el cuerpo, lo valida campo a campo y, si hay
 * errores, responde con un 400 y los registra en el log sin llegar a ejecutar el handler.
 * Para cualquier otro método HTTP la validación se omite.
 *
 * ### Uso
 * ```ts
 * const schema = buildSpecification({
 *     name: { type: 'string', required: true, description: 'Nombre' },
 * });
 *
 * class MiHandler {
 *     @validate(schema)
 *     async handle(conexion: Conexion): Promise<number> { ... }
 * }
 * ```
 *
 * @param schema - Especificación del esquema contra el que validar el cuerpo.
 * @returns Decorador de método compatible con TypeScript.
 */
export const validate = <T extends CustomSpecification>(schema: T): Function => {
    return function (_target: object, _propertyKey: string | symbol, descriptor: PropertyDescriptor): void {
        const originalMethod = descriptor.value as (...args: any[]) => Promise<unknown>;
        descriptor.value = async function (this: unknown, ...args: unknown[]): Promise<unknown> {
            const connection = args.find(arg => arg instanceof Conexion) as Conexion | undefined;

            if (connection?.metodo === 'POST') {
                const postData = connection.post as Record<string, unknown>;
                const contentType = connection.getHeaders()["content-type"]?.toLowerCase() ?? "";
                const isMultipart = contentType.includes("multipart");

                const errors = validateObject(postData, schema, isMultipart);
                if (errors.length > 0) {
                    error(`Validation errors: ${errors.join(', ')}`);
                    return connection.error(400, 'Bad Request');
                }
            }

            return originalMethod.apply(this, args);
        };
    };
};

/**
 * Valida un campo individual contra su {@link FieldDefinition}.
 *
 * En formularios multipart (`isMultipart = true`), los campos numéricos pueden llegar
 * como `string` y se aceptan si el valor es convertible a número.
 *
 * @param key         - Nombre del campo.
 * @param validator   - Definición del campo con tipo, obligatoriedad y regexp.
 * @param value       - Valor extraído del objeto a validar.
 * @param isMultipart - `true` si la petición es de tipo `multipart/form-data`.
 * @returns Lista de mensajes de error. Vacía si el campo es válido.
 */
const validateField = (key: string, validator: FieldDefinition, value: unknown, isMultipart: boolean): string[] => {
    const errors: string[] = [];

    if (value === null || value === undefined) {
        if (validator.required) {
            errors.push(`El campo ${key} es obligatorio.`);
        }
        return errors;
    }

    if (validator.type === 'string') {
        if (typeof value !== 'string') {
            errors.push(`El campo ${key} debe ser una cadena.`);
        } else if (validator.regexp !== undefined && !validator.regexp.test(value)) {
            errors.push(`El campo ${key} no cumple el formato requerido.`);
        }
    } else if (validator.type === 'number') {
        const isNumericString = isMultipart && typeof value === 'string';
        if (typeof value !== 'number' && !isNumericString) {
            errors.push(`El campo ${key} debe ser un número.`);
        }
    }

    return errors;
};

/**
 * Valida un objeto contra un {@link CustomSpecification}.
 *
 * Itera todos los campos del esquema y acumula los errores de validación.
 * Los campos de tipo `array` u `object` no se validan en profundidad por el momento.
 *
 * @param obj         - Objeto a validar (cuerpo de la petición).
 * @param schema      - Esquema contra el que validar.
 * @param isMultipart - `true` si la petición es de tipo `multipart/form-data`.
 * @returns Lista de mensajes de error. Vacía si el objeto es válido.
 */
const validateObject = <T extends CustomSpecification>(obj: unknown, schema: T, isMultipart = false): string[] => {
    if (typeof obj !== 'object' || obj === null) {
        return ['El objeto a validar debe ser un objeto válido.'];
    }

    const record = obj as Record<string, unknown>;
    const errors: string[] = [];

    for (const [key, validator] of Object.entries(schema)) {
        errors.push(...validateField(key, validator, record[key], isMultipart));
    }

    return errors;
};
