/**
 * Editor: Bixus
 * Fecha: Thu, 03 Sep 2026 09:20:09 GMT
 * Hash: fc18a553304ea6f397aa6eb1ccd3a688
 * Versión: 2026.9.3+2-bixus
 * Proyecto: https://github.com/meteored-status/svc-logs.git
 */

import {describe, it} from "node:test";
import assert from "node:assert/strict";

import {arrayChop, arrayEquals, unique} from "../../modules/utiles/array";

describe("arrayChop", () => {

    it("trocea en bloques del tamaño pedido", () => {
        assert.deepEqual(arrayChop([1, 2, 3, 4, 5], 2), [[1, 2], [3, 4], [5]]);
    });

    it("devuelve un único bloque si caben todos", () => {
        assert.deepEqual(arrayChop([1, 2, 3], 3), [[1, 2, 3]]);
        assert.deepEqual(arrayChop([1, 2, 3], 10), [[1, 2, 3]]);
    });

    it("no trocea si el tamaño es 0 o negativo", () => {
        assert.deepEqual(arrayChop([1, 2, 3], 0), [[1, 2, 3]]);
        assert.deepEqual(arrayChop([1, 2, 3], -5), [[1, 2, 3]]);
    });

    it("un array vacío no produce ningún bloque", () => {
        // devolvía [[]] — un bloque vacío que obligaba a quien lo consumía a comprobar el tamaño
        // antes de llamar, y que si no acababa en un INSERT/bulk sin filas
        assert.deepEqual(arrayChop([], 1000), []);
        assert.deepEqual(arrayChop([], 0), []);
        assert.deepEqual(arrayChop([]), []);
    });

    it("no pierde ni reordena elementos", () => {
        const original = Array.from({length: 47}, (_, i)=>i);
        const bloques = arrayChop(original, 10);

        assert.equal(bloques.length, 5);
        assert.deepEqual(bloques.flat(), original);
        assert.ok(bloques.every(bloque=>bloque.length<=10));
    });

    it("no modifica el array de entrada", () => {
        const original = [1, 2, 3, 4];
        arrayChop(original, 2);

        assert.deepEqual(original, [1, 2, 3, 4]);
    });
});

describe("unique", () => {

    it("elimina duplicados conservando el primer orden de aparición", () => {
        assert.deepEqual(unique([3, 1, 3, 2, 1]), [3, 1, 2]);
        assert.deepEqual(unique<string>([]), []);
    });
});

describe("arrayEquals", () => {

    it("compara sin tener en cuenta el orden", () => {
        assert.equal(arrayEquals([1, 2, 3], [3, 2, 1]), true);
        assert.equal(arrayEquals([1, 2], [1, 2, 3]), true, "solo comprueba que todos los del primero estén en el segundo");
        assert.equal(arrayEquals([1, 4], [1, 2, 3]), false);
    });
});
