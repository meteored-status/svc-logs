/**
 * Editor: miguel
 * Fecha: Mon, 16 Nov 2026 15:13:05 GMT
 * Hash: 1b5e3d22b1fa8b34d3058446207f54a2
 * Versión: 2026.11.16+1-miguel
 * Anterior: 2026.11.12+1-miguel
 * Proyecto: https://github.com/alpred/meteored-web-www.git
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
 * Un tipo de cookie con su valor por defecto.
 *
 * @property tipo - El tipo (ver {@link TNombreTipo}).
 * @property defecto - Valor por defecto del tipo.
 */
export interface ITipo<K extends TNombreTipo> {
    tipo: K;
    defecto: TValor<K>;
}

/**
 * Los tipos disponibles ({@link TNombreTipo}: los básicos y sus listas)
*/
export const Tipos: {[K in TNombreTipo]: ITipo<K>} = {
    string: {tipo: "string", defecto: ""},
    number: {tipo: "number", defecto: 0},
    entero: {tipo: "entero", defecto: 0},
    boolean: {tipo: "boolean", defecto: false},
    date: {tipo: "date", defecto: new Date(0)},
    "string[]": {tipo: "string[]", defecto: []},
    "number[]": {tipo: "number[]", defecto: []},
    "entero[]": {tipo: "entero[]", defecto: []},
    "boolean[]": {tipo: "boolean[]", defecto: []},
    "date[]": {tipo: "date[]", defecto: []},
};

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
