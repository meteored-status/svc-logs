/**
 * Editor: Bixus
 * Fecha: Thu, 17 Sep 2026 14:19:23 GMT
 * Hash: a70245609a6dfdb444d2c8615ff9c7f4
 * Versión: 2026.9.17+2-bixus
 * Anterior: 2026.9.16+1-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

import {describe, it} from "node:test";
import assert from "node:assert/strict";

import buildFunction from "../modules/util/plural-function-builder";

/**
 * `buildFunction` elige con qué reglas de plural se pinta un número. Un error aquí no rompe nada: sale la
 * forma equivocada en pantalla, en un idioma que probablemente no lea quien lo escribió.
 */
describe("buildFunction", () => {

    it("usa las reglas del idioma pedido", () => {
        assert.equal(buildFunction("es")(1), "one");
        assert.equal(buildFunction("es")(2), "other");
    });

    it("un tag con guion bajo no se va al inglés: se prueba con guion", () => {
        // `es_ES` lo rechaza Intl, y el apaño anterior —`substring(0, 3)`— daba `es_`, que también lo
        // rechaza: acababa en reglas inglesas. Ahora baja por la cadena y da con `es-ES`.
        assert.equal(buildFunction("pt_PT")(1000000), "many");
        assert.equal(buildFunction("pt-PT")(1000000), "many");
    });

    it("una variante que Intl no admite cae al idioma base, no al inglés", () => {
        // "inventadisimo" tiene trece caracteres y ninguna variante BCP 47 válida los tiene, así que el tag
        // está mal formado. La cadena lo deja en `ca`.
        assert.equal(buildFunction("ca-ES-inventadisimo")(0), buildFunction("ca")(0));
    });

    it("una variante que Intl sí admite se usa tal cual", () => {
        assert.equal(buildFunction("ca-ES-valencia")(1), "one");
    });

    it("lo que no es un idioma acaba en inglés", () => {
        assert.equal(buildFunction("")(0), "other");
        assert.equal(buildFunction("")(1), "one");
    });
});
