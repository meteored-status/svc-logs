/**
 * Editor: miguel
 * Fecha: Thu, 12 Nov 2026 11:34:11 GMT
 * Hash: 593369de88e393a21eb5560a738481cf
 * Versión: 2026.11.12+1-miguel
 * Proyecto: https://github.com/alpred/tiempo-web-javascript.git
 */

import type {ISerializador, ISerializadores} from "./basicos";

export * from "./basicos";
export * from "./lista";

/**
 * Tipo de dato básico de una cookie: una clave de {@link ISerializadores}
 * (`string`, `number`, `entero`, `boolean` o `date`).
 */
export type TTipoBase = keyof ISerializadores;

/**
 * Tipos de datos que puede tener la cookie.
 */
export type TNombreTipo = TTipoBase | `${TTipoBase}[]`;

/**
 * Tipo de TypeScript del valor de una cookie según su {@link TNombreTipo}.
 */
export type TValor<K extends TNombreTipo> = K extends `${infer B extends TTipoBase}[]`
    ? TValor<B>[]
    : K extends TTipoBase ? (ISerializadores[K] extends ISerializador<infer T> ? T : never) : never;

/**
 * Conversión de un valor, de cualquier {@link TNombreTipo}, a texto y de vuelta; `null` si el texto no es válido.
 */
export interface IConversion {
    serialize: (valor: unknown) => string;
    deserialize: (raw: string) => unknown;
}
