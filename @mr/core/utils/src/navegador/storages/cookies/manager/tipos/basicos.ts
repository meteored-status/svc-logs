/**
 * Editor: miguel
 * Fecha: Thu, 12 Nov 2026 11:34:11 GMT
 * Hash: 8dd1fb1fe0c5822af041e4ec94503356
 * Versión: 2026.11.12+1-miguel
 * Proyecto: https://github.com/alpred/tiempo-web-javascript.git
 */

/**
 * Tipos básicos que se pueden pasar a texto y volver.
 */
export type TTipoBasico = string | number | boolean | Date;

/**
 * Par de conversiones de un tipo básico a texto y de vuelta.
 *
 * `deserialize` devuelve `null` cuando el texto no es un valor válido del tipo.
 */
export interface ISerializador<T extends TTipoBasico> {
    serialize: (val: T) => string;
    deserialize: (raw: string) => T | null;
}

/**
 * Un serializador por cada tipo de {@link TTipoBasico}.
 */
export interface ISerializadores {
    string: ISerializador<string>;
    number: ISerializador<number>;
    entero: ISerializador<number>;
    boolean: ISerializador<boolean>;
    date: ISerializador<Date>;
}

export const Serializadores: ISerializadores = {
    string: {
        serialize: (val: string) => val,
        deserialize: (raw: string) => raw,
    },
    number: {
        serialize: (val: number) => String(val),
        deserialize: (raw: string) => {
            const num = Number(raw);
            return Number.isNaN(num) ? null : num;
        },
    },
    entero: {
        serialize: (val: number) => String(Math.trunc(val)),
        deserialize: (raw: string) => (/^-?\d+$/.test(raw) ? Number(raw) : null),
    },
    boolean: {
        serialize: (val: boolean) => String(val),
        deserialize: (raw: string) => {
            const valor = raw.toLowerCase();
            if (valor === "true") {
                return true;
            }
            return valor === "false" ? false : null;
        },
    },
    date: {
        serialize: (val: Date) => val.toISOString(),
        deserialize: (raw: string) => {
            const fecha = new Date(raw);
            return Number.isNaN(fecha.getTime()) ? null : fecha;
        },
    },
};
