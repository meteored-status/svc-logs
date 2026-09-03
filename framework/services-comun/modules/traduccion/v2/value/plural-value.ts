/**
 * Editor: Bixus
 * Fecha: Wed, 02 Sep 2026 14:14:26 GMT
 * Hash: d984d29938cf6082620a6dd0b497e145
 * Versión: 2026.9.2+3-bixus
 * Anterior: 2026.6.17+7-josantoniojimnez
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

import {TParams, Value} from "./value";
import {TPluralKey} from ".";

export type TPluralFunction = (i: number) => TPluralKey;

/**
 * Un texto con formas de plural, resueltas por las categorías CLDR del idioma.
 *
 * **Necesita saber cuál de sus parámetros es el contador**, porque es el número que decide la forma. Con un
 * solo parámetro no hay ambigüedad y se deduce; con varios hay que decirlo, y para eso está `counter` —lo
 * declara el `.json` y lo emite el generador—.
 *
 * Antes, cuando no había exactamente un parámetro, esto llamaba a `_rules(0)`: la categoría del **cero**. No
 * fallaba, elegía mal y en silencio, y encima distinto según el idioma —en español y en inglés el cero es
 * `other`, así que salía siempre el plural; en francés es `one`, así que salía siempre el singular—. Ahora
 * revienta, que es lo que había que hacer desde el principio: sin contador no hay forma correcta que elegir.
 *
 * En la práctica no debería llegar aquí: `mrlang` rechaza al generar un plural que no diga cuál es su
 * contador. Esto es la red de debajo.
 */
export class PluralValue<T extends TParams={}> extends Value<T> {
    /* STATIC */

    /* INSTANCE */
    private readonly counter: string|undefined;

    /**
     * @param _value  - Las formas, indexadas por categoría CLDR.
     * @param _rules  - Qué categoría le toca a un número en este idioma.
     * @param params  - Los parámetros que interpola el texto.
     * @param counter - Cuál de ellos es el número que decide la forma. Con un solo parámetro se puede omitir:
     *                  se deduce que es ese. Es lo que permite que los módulos anteriores a este campo sigan
     *                  funcionando sin tocarlos.
     */
    public constructor(
        protected readonly _value: Partial<Record<TPluralKey, string>>,
        protected readonly _rules: TPluralFunction,
        params?: string[],
        counter?: string) {
        super(params ?? []);
        this.counter = counter ?? (this.paramsLength == 1 ? this.params[0] : undefined);
    }

    public override value(params?: Partial<T>) {
        if (this.counter == undefined) {
            throw new Error(`No se sabe cuál de los parámetros [${this.params.join(", ")}] es el contador del plural: declara "counter" en el .json`);
        }

        const key = this._rules(Number(params?.[this.counter]));

        const value = this._value[key];
        if (!value) {
            throw new Error(`Missing plural value for key "${key}"`);
        }
        return this.applyParams(value, params);
    }
}
