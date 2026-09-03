/**
 * Editor: Bixus
 * Fecha: Wed, 02 Sep 2026 14:14:26 GMT
 * Hash: 0f79cf114a8ba4d0614533eae3b27ba0
 * Versión: 2026.9.2+1-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

/**
 * Lo que hace falta saber de una entrada con plurales: cuál de sus parámetros es el contador.
 *
 * Vive aparte de los tres emisores porque los tres lo necesitan igual —una entrada de tipo `literal`, `map` o
 * `set` puede llevar plurales dentro— y porque la validación tiene que poder preguntarlo sin generar nada.
 */

import {JSONItem, JSONValor, JSONValorMap, JSONValorSet, JSONValue} from "../../data";

/**
 * Todos los valores de la entrada, vengan de donde vengan: los de cada idioma y el del defecto, y en un `map`
 * o un `set`, los de dentro.
 *
 * Se miran **todos** y no solo los del primer idioma porque un plural puede estar escrito en uno y no en otro:
 * basta con que exista en alguno para que la entrada necesite contador.
 */
const valores = (item: JSONItem): JSONValue[] => {
    const bloques: JSONValor[] = Object.values(item.values.valor);
    if (item.values.defecto != undefined) {
        bloques.push(item.values.defecto);
    }

    const salida: JSONValue[] = [];
    for (const bloque of bloques) {
        if (bloque == undefined) {
            continue;
        }
        if (item.tipo == "literal") {
            salida.push(bloque as JSONValue);
            continue;
        }
        const dentro = (bloque as JSONValorMap|JSONValorSet).valores;
        if (Array.isArray(dentro)) {
            salida.push(...dentro);
        } else if (dentro != undefined) {
            salida.push(...Object.values(dentro));
        }
    }

    return salida;
}

/**
 * Si la entrada tiene algún valor con formas de plural.
 *
 * @param item Entrada del `.json`.
 */
export const tienePlural = (item: JSONItem): boolean => valores(item).some(valor => valor?.type == "plural");

/**
 * Qué le falta a una entrada con plurales para poder resolverse, en frases listas para enseñar.
 *
 * El contador es **el número que decide la forma**, y sin él no hay elección correcta que hacer. Antes esto no
 * se comprobaba y el runtime resolvía por la categoría del cero: en español y en inglés salía siempre el
 * plural, en francés siempre el singular, y sin ningún aviso. Comprobarlo aquí lo convierte en un error al
 * generar, que es cuando lo está escribiendo quien puede arreglarlo.
 *
 * **Con un solo parámetro no se exige nada**: se deduce que es ese. Es lo que permite que los módulos escritos
 * antes de que `counter` existiera sigan generándose sin tocarlos.
 *
 * @param item Entrada del `.json`.
 * @returns Los problemas encontrados, vacío si no hay ninguno.
 */
export const problemasDePlural = (item: JSONItem): string[] => {
    if (!tienePlural(item)) {
        return [];
    }

    const params = item.params ?? [];
    const {counter} = item;

    if (params.length == 0) {
        return [`tiene formas de plural pero no declara "params", así que no hay ningún número con el que elegir la forma`];
    }

    if (counter == undefined) {
        if (params.length > 1) {
            return [`tiene formas de plural y ${params.length} parámetros ("${params.join('", "')}"), así que hay que declarar cuál es el contador con "counter"`];
        }

        return [];
    }

    if (!params.includes(counter)) {
        return [`declara counter "${counter}", que no está entre sus params ("${params.join('", "')}")`];
    }

    return [];
}

/**
 * El cuarto argumento de `PluralValue`, ya escrito, o cadena vacía si no hace falta.
 *
 * Solo se emite cuando la entrada lo declara: con un único parámetro el runtime lo deduce igual, y no emitirlo
 * deja idénticos los ficheros de los módulos que ya existían.
 *
 * @param item Entrada del `.json`.
 */
export const argumentoCounter = (item: JSONItem): string => item.counter != undefined ? `, "${item.counter}"` : "";
