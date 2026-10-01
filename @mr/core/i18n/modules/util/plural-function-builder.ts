/**
 * Editor: Bixus
 * Fecha: Wed, 23 Sep 2026 08:46:25 GMT
 * Hash: b4600ff8d1102ea22d3f13c90ce48cae
 * Versión: 2026.9.23+1-bixus
 * Anterior: 2026.9.17+2-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

import {langChain} from "./lang";
import type {TPluralKey} from "../value";
import type {TPluralFunction} from "../value/plural-value";

/**
 * Las reglas de plural de un idioma, bajando por su cadena de fallback antes de rendirse al inglés.
 *
 * `Intl.PluralRules` solo lanza cuando el tag está **mal formado**; uno bien formado que no conozca lo
 * resuelve al locale por defecto del entorno sin decir nada. Así que lo que hay que hacer con el que lanza
 * es probar el siguiente de la cadena —`es_ES` → `es-ES`, `ca-ES-inventado` → `ca-ES` → `ca`—, que es lo
 * mismo que hace el resto del paquete para elegir un idioma.
 *
 * Antes se intentaba con `lang.substring(0, 3).replaceAll("-", "")`. Con un tag normal acertaba de
 * casualidad —de `es-ES` salía `es`—, pero es un prefijo de longitud fija, no una subetiqueta: de `es_ES`
 * sale `es_`, que lanza y acababa en inglés, y de un código aplanado como `esES` sale `esE`, que **está
 * bien formado**, no lanza, y se lleva las reglas del locale por defecto de quien lo ejecute. Eso último
 * no da error en ninguna parte y cambia según la máquina.
 *
 * @param lang - Código de idioma.
 * @returns Las reglas del primer código de la cadena que `Intl` acepte, o las del inglés.
 */
const construirReglas = (lang: string): Intl.PluralRules => {
    for (const candidato of langChain(lang)) {
        try {
            return new Intl.PluralRules(candidato);
        } catch {
            // mal formado: se prueba el siguiente de la cadena
        }
    }

    return new Intl.PluralRules("en-US");
};

const buildFunction = (lang: string): TPluralFunction => {
    const pluralRules = construirReglas(lang);

    return (i: number) => pluralRules.select(i) as TPluralKey;
}

export default buildFunction;
