/**
 * Editor: Bixus
 * Fecha: Mon, 07 Sep 2026 13:12:27 GMT
 * Hash: 738f039874dc74021ebfe8f1a1eb6275
 * Versión: 2026.9.7+1-bixus
 * Anterior: 2026.9.3+4-bixus
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
 *
 * **De las formas que faltan hay dos clases, y no se tratan igual.** Un catálogo escribe `one` y `other`
 * —contar cosas del día a día no necesita más—, pero CLDR le da a bastantes idiomas categorías de
 * refinamiento que ese catálogo no menciona: `many` en castellano, francés, catalán, portugués o italiano
 * (el millón justo), `few` y `many` en ruso o polaco, `zero` en árabe. Que falte una de esas no es un
 * despiste de quien escribió el texto: es la distancia entre CLDR y lo que hace falta escribir, así que
 * **caen a `other`**, que es la categoría comodín —existe en todos los idiomas— y es justo lo que
 * significa un catálogo de dos formas. Que falte `one` o `other`, en cambio, sí es un despiste, y ahí
 * sigue lanzando: caer a la otra pintaría «1 días» y nadie se enteraría.
 *
 * Lanzaba también en el primer caso, y no era gratis: un contador de un millón justo —los hay, cuentan
 * registros de log por tramo— revienta dentro del render de un tooltip de gráfica, y eso se lleva por
 * delante la página entera en vez de pintar un texto con menos matiz del que podría.
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

        const value = this.forma(key);
        if (!value) {
            throw new Error(`Missing plural value for key "${key}"`);
        }
        return this.applyParams(value, params);
    }

    /**
     * La forma escrita para una categoría, con la comodín debajo cuando la categoría es de refinamiento.
     *
     * @param key - La categoría que ha elegido el idioma para este número.
     * @returns La forma que pintar, o `undefined` si no hay ninguna defendible.
     */
    private forma(key: TPluralKey): string|undefined {
        const propia = this._value[key];
        if (propia) {
            return propia;
        }

        // `one` y `other` son el contrato de toda entrada: debajo no hay nada a lo que caer, y caer a la
        // otra cambiaría el texto en el caso más frecuente de todos en vez de en el más raro.
        if (key == "one" || key == "other") {
            return undefined;
        }

        return this._value.other;
    }
}
