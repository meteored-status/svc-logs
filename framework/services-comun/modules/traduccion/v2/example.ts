/**
 * Editor: Juan C. Martínez
 * Fecha: Wed, 17 Jun 2026 12:19:18 GMT
 * Hash: cf5f668ec4f5269fec770ede22d0238b
 * Versión: 2026.6.17+6-juancmartinez
 */

import {SingularValue} from "./value/singular-value";
import {PluralValue} from "./value/plural-value";
import pluralBuilder from "./util/plural-function-builder";
import {Literal} from "./literal";
import {TranslationMap} from "./translation-map";

const v1 = '<b>Povolte nám</b> přistup ke své poloze <b>trvale</b>, abychom mohli aktualizovat polohu, kde se nacházíte a poskytovat vám předpovědi počasí, výstrahy, teplotu v oznamovací liště, widgety a oznamování důležitých události pro dané místo, i když je aplikace zavřená nebo se nepoužívá.';

const var1 = new SingularValue<{
    hola: string;
}>(v1, ["hola"]);

console.log(var1.value({
    hola:  "Hola"
}));

const var2 = new PluralValue<{
    hola: string;
}>({
    one: '{{hola}}',
}, pluralBuilder('es'));

console.log(var2.value({
    hola: "2"
}))


const l1 = new Literal(var1);
console.log(l1.render());

const m1 = new TranslationMap<"0" | "1">({
    "0": var1,
    "1": var2,
})

