/**
 * Editor: Bixus
 * Fecha: Mon, 07 Sep 2026 13:12:27 GMT
 * Hash: e90fa9e6e97abdab04c8ecdad12e7359
 * Versión: 2026.9.7+1-bixus
 * Anterior: 2026.9.4+2-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

/**
 * Lo que hace falta saber de los idiomas de un módulo: si están todas sus entradas en todos ellos.
 *
 * Vive aparte de `plural.ts` porque es otra cosa —aquello mira dentro de una entrada y esto compara unas con
 * otras— y porque la comprobación necesita el módulo entero, no una entrada suelta.
 */

import {JSONItem} from "../../data";

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
        const faltan = idiomas.filter(idioma => !suyos.has(idioma));
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
