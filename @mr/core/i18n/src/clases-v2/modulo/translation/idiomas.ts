/**
 * Editor: Bixus
 * Fecha: Mon, 28 Sep 2026 12:17:55 GMT
 * Hash: 83f27a60bb052bb2d6d8f884ea9762f4
 * Versión: 2026.9.28+2-bixus
 * Anterior: 2026.9.23+1-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

/**
 * Lo que hace falta saber de los idiomas de un módulo: si están todas sus entradas en todos ellos.
 *
 * Vive aparte de `plural.ts` porque es otra cosa —aquello mira dentro de una entrada y esto compara unas con
 * otras— y porque la comprobación necesita el módulo entero, no una entrada suelta.
 */

import type {JSONItem} from "../../data";
import {Lang} from "../../lang/lang";

/**
 * La lengua de un código, sin región ni variante: `es-MX` → `es`, `pt-BR` → `pt`.
 *
 * @param code Código de idioma.
 */
const lengua = (code: string): string => code.split(/[-_]/)[0].toLowerCase();

/**
 * Si la entrada cubre un idioma que no tiene escrito **heredándolo de un antecesor de su misma lengua**, que es
 * lo que hace el generador con `resolverValor()`: un `es-MX` sin valor propio sale con el de `es`, y eso no es un
 * descuido sino la herencia funcionando.
 *
 * La cadena es la del catálogo (`Lang`), la misma que recorre el generador, pero **se corta en cuanto cambia de
 * lengua**: `es-MX` → `es` vale, `es-MX` → `es` → `en` ya no, porque lo que sale en pantalla es inglés, que es
 * justo lo que el aviso quiere cazar. Lo mismo `ca` → `es-ES`: el catálogo lo declara así, pero a quien lee en
 * catalán le sale castellano.
 *
 * @param idioma El idioma que le falta a la entrada.
 * @param suyos  Los idiomas que la entrada sí tiene escritos.
 */
const heredaDeSuLengua = (idioma: string, suyos: Set<string>): boolean => {
    const suya = lengua(idioma);
    for (let actual = Lang.getByCode(idioma).parent; actual != null; actual = actual.parent) {
        if (lengua(actual.code) !== suya) {
            return false;
        }
        if (suyos.has(actual.code)) {
            return true;
        }
    }

    return false;
};

/**
 * Los idiomas del módulo: la unión de los que traen sus entradas.
 *
 * **No hay ninguna lista declarada** contra la que comparar —un `.json` no dice en qué idiomas está—, así que
 * el módulo se declara a sí mismo con lo que tienen sus entradas. Es lo que permite que un módulo escrito solo
 * en dos idiomas no se considere incompleto: si ninguna entrada tiene francés, es que ese módulo no está en
 * francés, y eso es una decisión, no un olvido.
 *
 * @param items Las entradas del módulo.
 */
const idiomasDelModulo = (items: JSONItem[]): string[] =>
    Array.from(new Set(items.flatMap(item => Object.keys(item.values.valor))));

/**
 * Entradas a las que les falta algún idioma que el resto del módulo sí tiene.
 *
 * Es el fallo que no delata nadie: `mrlang generate` no se queja de un idioma que falta, el runtime cae al
 * defecto y la pantalla sale **medio traducida**. Compila, se despliega, y solo lo ve quien la use en ese
 * idioma — que en un panel interno puede ser nadie durante meses.
 *
 * Se compara contra los idiomas que el propio módulo tiene, no contra una lista fija, así que un módulo que
 * todavía no está en un idioma no avisa de nada: lo que se detecta es la **incoherencia dentro del módulo**,
 * que es lo que de verdad es un descuido — cuarenta y cuatro entradas con catalán y una sin.
 *
 * Un idioma que falta pero **se hereda de otro de su misma lengua** no cuenta como falta (ver
 * `heredaDeSuLengua()`): dejar `es-MX` sin escribir porque vale el de `es` es la forma normal de usar la
 * herencia, y avisar de eso llenaba la salida de falsos positivos que tapaban los de verdad.
 *
 * Va por el canal de avisos y **no corta la generación**, como el del contador: traducir un módulo entrada a
 * entrada es un estado legítimo mientras se está haciendo, y romperle el build a quien está en mitad de eso
 * sería la forma más rápida de que alguien lo desactive.
 *
 * @param items Las entradas del módulo.
 * @returns Los avisos encontrados, vacío si el módulo está completo.
 */
export const avisosDeIdioma = (items: JSONItem[]): {id: string; aviso: string}[] => {
    const idiomas = idiomasDelModulo(items);
    if (idiomas.length < 2) {
        return [];
    }

    const salida: {id: string; aviso: string}[] = [];
    for (const item of items) {
        const suyos = new Set(Object.keys(item.values.valor));
        const faltan = idiomas.filter(idioma => !suyos.has(idioma) && !heredaDeSuLengua(idioma, suyos));
        if (faltan.length == 0) {
            continue;
        }

        salida.push({
            id: item.id,
            aviso: `no tiene ${faltan.length == 1 ? "el idioma" : "los idiomas"} "${faltan.join('", "')}", que el resto del módulo sí tiene. Sin ${faltan.length == 1 ? "él" : "ellos"} esa entrada cae al defecto y la pantalla sale medio traducida`,
        });
    }

    return salida;
}
