/**
 * Editor: Juan C. Martínez
 * Fecha: Wed, 17 Jun 2026 12:19:18 GMT
 * Hash: dafe729641022ff4e854b7be65a5ba57
 * Versión: 2026.6.17+6-juancmartinez
 */

import {TPluralKey} from "../value";
import {TPluralFunction} from "../value/plural-value.ts";

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
