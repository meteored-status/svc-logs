/**
 * Editor: miguel
 * Fecha: Wed, 29 Jul 2026 07:22:10 GMT
 * Hash: c30f1e7ff1ab19e12ed419c7070218eb
 * Versión: 2026.7.29+1-miguel
 * Anterior: 2026.6.17+6-juancmartinez
 * Proyecto: https://github.com/alpred/meteored-workers
 */

import {TPluralKey} from "../value";
import {TPluralFunction} from "../value/plural-value";

const buildFunction = (lang: string): TPluralFunction => {
    let pluralRules;
    try {
        try {
            pluralRules = new Intl.PluralRules(lang);
        } catch (e) {
            pluralRules = new Intl.PluralRules(lang.substring(0, 3).replaceAll('\-', ''));
        }
    } catch (e) {
        pluralRules = new Intl.PluralRules('en-US');
    }

    return (i: number) => pluralRules.select(i) as TPluralKey;
}

export default buildFunction;
