/**
 * Editor: Bixus
 * Fecha: Mon, 07 Sep 2026 13:12:27 GMT
 * Hash: 4b7c7ebc8dc5effaa0c170289f1f01f6
 * Versión: 2026.9.7+1-bixus
 * Anterior: 2026.9.3+4-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

import {describe, it} from "node:test";
import assert from "node:assert/strict";

import {PluralValue} from "../modules/value/plural-value";
import buildFunction from "../modules/util/plural-function-builder";

/**
 * El plural es el único texto cuya forma la decide un dato y no el idioma, así que es el único que puede
 * elegir mal sin que falle nada. Estas pruebas fijan de quién sale el número.
 */

const ES = buildFunction("es-ES");
const EN = buildFunction("en-US");
const FR = buildFunction("fr-FR");

const FORMAS = {one: "{{n}} día", other: "{{n}} días"};

describe("PluralValue · de dónde sale el número", () => {

    it("con un solo parámetro no hay que declarar el contador: se deduce", () => {
        const valor = new PluralValue<{n: number}>(FORMAS, ES, ["n"]);

        assert.equal(valor.value({n: 1}), "1 día");
        assert.equal(valor.value({n: 5}), "5 días");
    });

    it("con varios parámetros el contador es el que diga 'counter', no el primero", () => {
        // El caso real que destapó el fallo: «N de un total de M días medidos» concuerda con el TOTAL,
        // que es el segundo parámetro. Una heurística de «usa el primero» habría elegido el otro.
        const valor = new PluralValue<{caidos: number, total: number}>(
            {one: "{{caidos}} de {{total}} día", other: "{{caidos}} de {{total}} días"},
            ES, ["caidos", "total"], "total",
        );

        // El primer parámetro vale 1 y el contador 5: si mirase al primero, saldría el singular.
        assert.equal(valor.value({caidos: 1, total: 5}), "1 de 5 días");
        // Y al revés: contador 1 con el primero en 5 tiene que dar singular.
        assert.equal(valor.value({caidos: 5, total: 1}), "5 de 1 día");
    });

    it("con varios parámetros y sin contador revienta, en vez de elegir mal en silencio", () => {
        const valor = new PluralValue<{a: number, b: number}>(FORMAS, ES, ["a", "b"]);

        assert.throws(() => valor.value({a: 1, b: 2}), /counter/);
    });

    it("no mira la categoría del cero: era el fallo, y en francés cambiaba la forma", () => {
        // `Intl.PluralRules("fr").select(0)` es `one`, no `other`. El código anterior preguntaba por el
        // cero cuando no había exactamente un parámetro, así que en francés todo salía en singular.
        assert.equal(FR(0), "one", "premisa: en francés el cero es singular");
        assert.equal(ES(0), "other", "premisa: en español el cero es plural");

        const valor = new PluralValue<{caidos: number, total: number}>(
            {one: "{{total}} jour", other: "{{total}} jours"},
            FR, ["caidos", "total"], "total",
        );

        assert.equal(valor.value({caidos: 0, total: 5}), "5 jours");
    });
});

describe("PluralValue · las formas", () => {

    it("interpola también los parámetros que no son el contador", () => {
        const valor = new PluralValue<{servicio: string, n: number}>(
            {one: "{{servicio}}: {{n}} caída", other: "{{servicio}}: {{n}} caídas"},
            ES, ["servicio", "n"], "n",
        );

        assert.equal(valor.value({servicio: "api", n: 3}), "api: 3 caídas");
    });

    it("si al idioma le falta la forma que toca, avisa en vez de pintar vacío", () => {
        const valor = new PluralValue<{n: number}>({other: "{{n}} días"}, ES, ["n"]);

        assert.equal(valor.value({n: 5}), "5 días");
        assert.throws(() => valor.value({n: 1}), /Missing plural value/);
    });

    it("cada idioma parte las formas donde le toca", () => {
        assert.equal(ES(1), "one");
        assert.equal(ES(2), "other");
        assert.equal(EN(1), "one");
        assert.equal(EN(2), "other");
        // En francés el 1 y el 0 comparten forma, y eso es justo lo que rompía antes.
        assert.equal(FR(1), "one");
        assert.equal(FR(2), "other");
    });
});

describe("PluralValue · las categorías que el catálogo no declara", () => {

    it("premisa: es, fr y ca tienen una categoría más que el catálogo escribe, y en no", () => {
        // El catálogo del panel escribe dos formas —`one` y `other`— porque son las que hacen falta para
        // contar cosas del día a día. Pero CLDR le da a los tres idiomas latinos una tercera, `many`, que
        // el catálogo no menciona en ninguna de sus 52 entradas.
        assert.deepEqual(new Intl.PluralRules("es").resolvedOptions().pluralCategories, ["one", "many", "other"]);
        assert.deepEqual(new Intl.PluralRules("fr").resolvedOptions().pluralCategories, ["one", "many", "other"]);
        assert.deepEqual(new Intl.PluralRules("ca").resolvedOptions().pluralCategories, ["one", "many", "other"]);
        // En inglés no existe: por eso esto no se ve nunca en el idioma por defecto.
        assert.deepEqual(new Intl.PluralRules("en").resolvedOptions().pluralCategories, ["one", "other"]);
    });

    it("premisa: `many` no es «un número grande», es el millón justo", () => {
        // Importa para calibrar el riesgo: no lo dispara cualquier cifra de siete dígitos, solo los
        // múltiplos exactos de un millón. Un contador que pasa por ahí de largo no lo toca nunca.
        assert.equal(ES(999999), "other");
        assert.equal(ES(1000000), "many");
        assert.equal(ES(1000001), "other");
        assert.equal(ES(1500000), "other");
        assert.equal(ES(2000000), "many");
    });

    it("si al idioma le sobra una categoría, cae a `other` en vez de reventar la pantalla", () => {
        // Esto es lo que se rompía: con solo `{one, other}` escritas, un contador de un millón justo
        // lanzaba, y lanzar dentro del render de un tooltip de gráfica se lleva por delante la página
        // entera. `other` es la categoría comodín de CLDR —existe en todos los idiomas— y es exactamente
        // lo que significa un catálogo de dos formas, así que es la caída correcta, no una moneda al aire.
        for (const [idioma, rules, esperado] of [
            ["es", ES, "1000000 registros"],
            ["fr", FR, "1000000 registros"],
            ["ca", buildFunction("ca-ES"), "1000000 registros"],
        ] as const) {
            const valor = new PluralValue<{n: number}>({one: "{{n}} registro", other: "{{n}} registros"}, rules, ["n"]);

            assert.equal(rules(1000000), "many", `premisa: en ${idioma} el millón es \`many\``);
            assert.equal(valor.value({n: 1000000}), esperado, `en ${idioma}`);
        }
    });

    it("si el idioma sí declara `many`, se usa esa y no la comodín", () => {
        // La caída a `other` es la red de debajo, no una excusa para no escribir la forma: en castellano y
        // en catalán el millón lleva «de» («1.000.000 de registros»), y en francés se elide («d'…»).
        const valor = new PluralValue<{n: number}>(
            {one: "{{n}} registro", other: "{{n}} registros", many: "{{n}} de registros"},
            ES, ["n"],
        );

        assert.equal(valor.value({n: 5}), "5 registros");
        assert.equal(valor.value({n: 1000000}), "1000000 de registros");
    });

    it("las dos formas obligatorias siguen siendo obligatorias: si falta `one`, lanza", () => {
        // La caída solo cubre las categorías de refinamiento (`zero`, `two`, `few`, `many`). `one` y
        // `other` son el contrato de toda entrada del catálogo, y que falte una es un despiste de quien la
        // escribió, no un hueco de CLDR: ahí sigue haciendo falta el aviso ruidoso, porque caer a `other`
        // pintaría «1 días» y nadie se enteraría.
        const sinSingular = new PluralValue<{n: number}>({other: "{{n}} días"}, ES, ["n"]);
        assert.throws(() => sinSingular.value({n: 1}), /Missing plural value/);

        // Y si lo que falta es la comodín, no hay nada a lo que caer.
        const sinComodin = new PluralValue<{n: number}>({one: "{{n}} día"}, ES, ["n"]);
        assert.throws(() => sinComodin.value({n: 5}), /Missing plural value/);
        assert.throws(() => sinComodin.value({n: 1000000}), /Missing plural value/);
    });
});
