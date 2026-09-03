/**
 * Editor: Bixus
 * Fecha: Thu, 03 Sep 2026 06:58:23 GMT
 * Hash: cf5435e60a3a40b9b83247539b9fdeaf
 * Versión: 2026.9.3+1-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

import {describe, it} from "node:test";
import assert from "node:assert/strict";

import {PluralValue} from "../../../modules/traduccion/v2/value/plural-value";
import buildFunction from "../../../modules/traduccion/v2/util/plural-function-builder";

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
