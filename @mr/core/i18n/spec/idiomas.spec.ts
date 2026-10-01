/**
 * Editor: Bixus
 * Fecha: Mon, 28 Sep 2026 12:17:55 GMT
 * Hash: 89d3aa89763020471debe1399b0a4a24
 * Versión: 2026.9.28+2-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

import {describe, it} from "node:test";
import assert from "node:assert/strict";

import type {JSONItemLiteral, JSONValueSingular} from "../src/clases-v2/data";
import {avisosDeIdioma} from "../src/clases-v2/modulo/translation/idiomas";

/**
 * Una entrada literal con un valor por cada idioma que se le pase; el texto da igual, lo que se mira son las
 * claves.
 *
 * @param id      Id de la entrada.
 * @param idiomas Los idiomas que tiene escritos.
 */
const entrada = (id: string, idiomas: string[]): JSONItemLiteral => {
    const valor: JSONValueSingular = {type: "singular", value: id};
    return {
        id,
        origen: "interno",
        tipo: "literal",
        values: {
            valor: Object.fromEntries(idiomas.map(idioma => [idioma, valor])),
        },
    };
};

/**
 * Los idiomas de los que avisa cada entrada, por id, para comparar sin depender del texto del mensaje.
 *
 * @param items Las entradas del módulo.
 */
const faltas = (items: JSONItemLiteral[]): Record<string, string[]> => Object.fromEntries(
    avisosDeIdioma(items).map(({id, aviso}) => [id, Array.from(aviso.matchAll(/"([^"]+)"/g), m => m[1])]),
);

/**
 * El aviso de idiomas que faltan tiene que ver la herencia igual que la ve el generador: lo que se hereda de la
 * misma lengua no es una falta, y lo que acaba en otra lengua sí.
 */
describe("avisosDeIdioma", () => {

    it("no avisa de un es-MX que se hereda del es de la propia entrada", () => {
        const items = [
            entrada("completa", ["es", "es-MX", "en"]),
            entrada("sin_mx", ["es", "en"]),
        ];
        assert.deepEqual(faltas(items), {});
    });

    it("no avisa de en-CA ni en-GB cuando la entrada tiene en", () => {
        const items = [
            entrada("completa", ["en", "en-CA", "en-GB", "es"]),
            entrada("solo_en", ["en", "es"]),
        ];
        assert.deepEqual(faltas(items), {});
    });

    it("sí avisa de un es-MX cuya cadena solo llega al inglés", () => {
        const items = [
            entrada("completa", ["es", "es-MX", "en"]),
            entrada("sin_es", ["en"]),
        ];
        assert.deepEqual(faltas(items), {sin_es: ["es", "es-MX"]});
    });

    it("sí avisa de ca aunque el catálogo lo haga heredar de es-ES: sale otra lengua", () => {
        const items = [
            entrada("completa", ["es-ES", "ca", "en"]),
            entrada("sin_ca", ["es-ES", "en"]),
        ];
        assert.deepEqual(faltas(items), {sin_ca: ["ca"]});
    });

    it("un hermano no cubre: en-GB no sirve a en-CA", () => {
        const items = [
            entrada("completa", ["en-CA", "en-GB"]),
            entrada("sin_ca", ["en-GB"]),
        ];
        assert.deepEqual(faltas(items), {sin_ca: ["en-CA"]});
    });

    it("sigue avisando de un idioma que falta sin herencia posible", () => {
        const items = [
            entrada("completa", ["es", "fr", "de"]),
            entrada("sin_fr", ["es", "de"]),
        ];
        assert.deepEqual(faltas(items), {sin_fr: ["fr"]});
    });
});
