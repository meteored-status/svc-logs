/**
 * Editor: Bixus
 * Fecha: Mon, 07 Sep 2026 13:12:27 GMT
 * Hash: fc81f2b618fe50d29ced8bdad3bde4d2
 * Versión: 2026.9.7+1-bixus
 * Anterior: 2026.9.3+1-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

import {describe, it} from "node:test";
import assert from "node:assert/strict";

import {SingularValue} from "../modules/value/singular-value";
import {TranslationSet} from "../modules/translation-set";

/**
 * El conjunto es la lista ordenada: los meses, los días de la semana, los pasos de una guía. Se accede por
 * posición, así que el orden es parte del contrato.
 */

const dias = () => new TranslationSet([
    new SingularValue("Lunes"),
    new SingularValue("Martes"),
]);

describe("TranslationSet", () => {

    it("devuelve por posición y conserva el orden", () => {
        const conjunto = dias();

        assert.equal(conjunto.get(0), "Lunes");
        assert.equal(conjunto.get(1), "Martes");
        assert.equal(conjunto.size, 2);
    });

    it("allValues devuelve todo en orden", () => {
        assert.deepEqual(dias().allValues(), ["Lunes", "Martes"]);
    });

    it("pasa los parámetros a cada valor", () => {
        const conjunto = new TranslationSet<{n: number}>([
            new SingularValue("Paso {{n}}", ["n"]),
        ]);

        assert.equal(conjunto.get(0, {n: 3}), "Paso 3");
        assert.deepEqual(conjunto.allValues({n: 3}), ["Paso 3"]);
    });

    it("has encuentra un valor exacto", () => {
        assert.equal(dias().has("Lunes"), true);
        assert.equal(dias().has("Jueves"), false);
    });

    it("has con ignoreMayus no distingue mayúsculas, venga como venga el argumento", () => {
        // La bandera normaliza los dos lados. Antes solo pasaba a minúsculas el valor guardado, así que
        // `has("Lunes", …, true)` era falso mientras que `has("Lunes")` era cierto: activarla convertía
        // un acierto en fallo salvo que quien llamaba trajera ya el texto en minúsculas.
        assert.equal(dias().has("Lunes", undefined, true), true);
        assert.equal(dias().has("lunes", undefined, true), true);
        assert.equal(dias().has("LUNES", undefined, true), true);
    });

    it("has con ignoreMayus sigue sin encontrar lo que no está", () => {
        assert.equal(dias().has("jueves", undefined, true), false);
    });
});
