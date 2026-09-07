/**
 * Editor: Bixus
 * Fecha: Mon, 07 Sep 2026 13:12:27 GMT
 * Hash: bcf7d85612d3958ff52827d4455abd2d
 * Versión: 2026.9.7+1-bixus
 * Anterior: 2026.9.3+3-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

/**
 * Lo que hace falta saber de una entrada con plurales: cuál de sus parámetros es el contador.
 *
 * Vive aparte de los tres emisores porque los tres lo necesitan igual —una entrada de tipo `literal`, `map` o
 * `set` puede llevar plurales dentro— y porque la validación tiene que poder preguntarlo sin generar nada.
 */

import {JSONItem, JSONValor, JSONValorMap, JSONValorSet, JSONValue, JSONValuePlural} from "../../data";

/**
 * Un valor con la etiqueta de dónde sale: el código de idioma, `defecto`, y dentro de un `map` o un `set`, su
 * clave o su posición. Sirve para que un aviso pueda decir **en qué idioma** ha visto lo que ha visto.
 *
 * @property etiqueta - De dónde sale: `"es"`, `"defecto"`, `"es.critica"`, `"defecto[2]"`…
 * @property valor    - El valor en sí.
 */
interface IValorEtiquetado {
    etiqueta: string;
    valor: JSONValue;
}

/**
 * Todos los valores de la entrada, vengan de donde vengan: los de cada idioma y el del defecto, y en un `map`
 * o un `set`, los de dentro.
 *
 * Se miran **todos** y no solo los del primer idioma porque un plural puede estar escrito en uno y no en otro:
 * basta con que exista en alguno para que la entrada necesite contador.
 */
const valores = (item: JSONItem): IValorEtiquetado[] => {
    const bloques: [string, JSONValor|undefined][] = Object.entries(item.values.valor);
    if (item.values.defecto != undefined) {
        bloques.push(["defecto", item.values.defecto]);
    }

    const salida: IValorEtiquetado[] = [];
    for (const [etiqueta, bloque] of bloques) {
        if (bloque == undefined) {
            continue;
        }
        if (item.tipo == "literal") {
            salida.push({etiqueta, valor: bloque as JSONValue});
            continue;
        }
        const dentro = (bloque as JSONValorMap|JSONValorSet).valores;
        if (Array.isArray(dentro)) {
            salida.push(...dentro.map((valor, indice) => ({etiqueta: `${etiqueta}[${indice}]`, valor})));
        } else if (dentro != undefined) {
            salida.push(...Object.entries(dentro).map(([clave, valor]) => ({etiqueta: `${etiqueta}.${clave}`, valor})));
        }
    }

    return salida;
}

/**
 * Si la entrada tiene algún valor con formas de plural.
 *
 * @param item Entrada del `.json`.
 */
export const tienePlural = (item: JSONItem): boolean => valores(item).some(({valor}) => valor?.type == "plural");

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
 * Un hueco `{{param}}`, aunque venga pegado a puntuación (`({{n}})`, `{{pct}}%`).
 */
const HUECO = /\{\{\s*([A-Za-z0-9_]+)\s*\}\}/;

/** El texto en palabras, que es la unidad con la que se comparan dos formas. */
const trocear = (texto: string): string[] => texto.split(/\s+/).filter(trozo => trozo.length > 0);

/** El parámetro que hay dentro de una palabra, si la palabra es —o contiene— un hueco. */
const hueco = (trozo: string): string|undefined => HUECO.exec(trozo)?.[1];

/**
 * Con qué parámetro concuerda la diferencia entre dos formas de plural, o `undefined` si no se puede decidir.
 *
 * La idea es que la concordancia se ve en **lo que cambia** de una forma a la otra: en «{{n}} de {{total}} día»
 * contra «{{n}} de {{total}} días», lo único que cambia es «día», y el número que lo gobierna es el hueco que
 * tiene al lado, `total`. Así que se recorta el prefijo y el sufijo comunes, y de lo que queda en medio se
 * busca el hueco más cercano.
 *
 * Devuelve `undefined` —y por tanto no se avisa de nada— en los tres casos en los que la pista no es fiable:
 * las dos formas son idénticas, lo que cambia abarca varios huecos, o no hay ningún hueco del que tirar. Es
 * deliberado: esto es una heurística sobre lenguaje natural y un falso positivo cuesta más que un despiste sin
 * detectar, porque enseña a ignorar los avisos.
 */
const concordancia = (una: string, otra: string): string|undefined => {
    const a = trocear(una);
    const b = trocear(otra);

    let prefijo = 0;
    while (prefijo < a.length && prefijo < b.length && a[prefijo] == b[prefijo]) {
        prefijo++;
    }
    let sufijo = 0;
    while (sufijo < a.length-prefijo && sufijo < b.length-prefijo && a[a.length-1-sufijo] == b[b.length-1-sufijo]) {
        sufijo++;
    }
    if (a.length-sufijo <= prefijo && b.length-sufijo <= prefijo) {
        return undefined;
    }

    const dentro = new Set<string>();
    for (const trozo of [...a.slice(prefijo, a.length-sufijo), ...b.slice(prefijo, b.length-sufijo)]) {
        const nombre = hueco(trozo);
        if (nombre != undefined) {
            dentro.add(nombre);
        }
    }
    if (dentro.size == 1) {
        return Array.from(dentro)[0];
    }
    if (dentro.size > 1) {
        return undefined;
    }

    // Ninguno dentro: manda el más cercano por fuera, y a igual distancia el de la izquierda, que es donde lo
    // ponen los tres idiomas del panel («2 días», no «días 2»). El prefijo y el sufijo son comunes a las dos
    // formas, así que basta recorrer una.
    let izquierda: {distancia: number; nombre: string}|undefined;
    for (let i = prefijo-1; i >= 0; i--) {
        const nombre = hueco(a[i]);
        if (nombre != undefined) {
            izquierda = {distancia: prefijo-i, nombre};
            break;
        }
    }
    let derecha: {distancia: number; nombre: string}|undefined;
    for (let i = a.length-sufijo; i < a.length; i++) {
        const nombre = hueco(a[i]);
        if (nombre != undefined) {
            derecha = {distancia: i-(a.length-sufijo)+1, nombre};
            break;
        }
    }
    if (izquierda != undefined && (derecha == undefined || izquierda.distancia <= derecha.distancia)) {
        return izquierda.nombre;
    }

    return derecha?.nombre;
}

/**
 * Entradas cuyo `counter` **parece** ser el parámetro equivocado.
 *
 * Van por un canal aparte de `problemasDePlural()` y **no cortan la generación**, que es la diferencia que
 * importa: aquello comprueba datos que faltan —no hay contador, o no está entre los `params`— y esto adivina
 * intención a partir del texto. Un dato que falta es un error; una corazonada, un aviso.
 *
 * Lo que detecta es el fallo que `problemasDePlural()` no puede ver: un contador que existe, está entre los
 * `params` y aun así no es el número con el que concuerda la frase. El runtime entonces elige la forma por el
 * número equivocado y sale «1 de 30 días» o «5 de 1 día» sin que nada falle. Con un solo parámetro no hay nada
 * que equivocar, así que solo se mira desde dos.
 *
 * Medido sobre los módulos del proyecto: 1.048 entradas, 0 avisos; y dando la vuelta al `counter` de las ocho
 * entradas que tienen varios parámetros, las 15 combinaciones erróneas salen todas.
 *
 * @param item Entrada del `.json`.
 * @returns Los avisos encontrados, vacío si no hay ninguno.
 */
export const avisosDePlural = (item: JSONItem): string[] => {
    const params = item.params ?? [];
    const {counter} = item;
    if (counter == undefined || params.length < 2 || !params.includes(counter)) {
        return [];
    }

    const salida: string[] = [];
    for (const {etiqueta, valor} of valores(item)) {
        if (valor?.type != "plural") {
            continue;
        }
        const formas = Object.values((valor as JSONValuePlural).value).filter((forma): forma is string => forma != undefined && forma.length > 0);
        for (let i = 0; i < formas.length-1; i++) {
            const manda = concordancia(formas[i], formas[i+1]);
            if (manda == undefined || manda == counter || !params.includes(manda)) {
                continue;
            }
            salida.push(`declara counter "${counter}", pero en "${etiqueta}" lo que cambia entre las formas concuerda con "{{${manda}}}" ("${formas[i]}" / "${formas[i+1]}"). Si es así, el contador es "${manda}"`);
            break;
        }
    }

    return salida;
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
