/**
 * Editor: Bixus
 * Fecha: Thu, 03 Sep 2026 06:58:23 GMT
 * Hash: 8535d7015d5d28ee8552917fc2c033dc
 * Versión: 2026.9.3+1-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

import {describe, it} from "node:test";
import assert from "node:assert/strict";

import {SingularValue} from "../../../modules/traduccion/v2/value/singular-value";

/**
 * La sustitución de `{{parametro}}` es de `Value`, así que la comparten literales, mapas, conjuntos y
 * plurales. Se prueba a través de `SingularValue` porque `Value` es abstracta.
 */
describe("Value · sustitución de parámetros", () => {

    it("sustituye todas las apariciones, no solo la primera", () => {
        const valor = new SingularValue<{x: string}>("{{x}} y {{x}}", ["x"]);

        assert.equal(valor.value({x: "hola"}), "hola y hola");
    });

    it("un parámetro que falta deja su nombre en mayúsculas, para que se vea en pantalla", () => {
        const valor = new SingularValue<{nombre: string}>("Hola {{nombre}}", ["nombre"]);

        assert.equal(valor.value({}), "Hola NOMBRE");
        assert.equal(valor.value(), "Hola NOMBRE");
    });

    it("el cero y la cadena vacía son valores, no ausencias", () => {
        // Con una comprobación de verdad/falsedad en vez de contra `undefined`, un contador a cero
        // pintaría «N» en mitad de la frase.
        const valor = new SingularValue<{n: number|string}>("[{{n}}]", ["n"]);

        assert.equal(valor.value({n: 0}), "[0]");
        assert.equal(valor.value({n: ""}), "[]");
    });

    it("un texto sin parámetros se devuelve tal cual", () => {
        const valor = new SingularValue("Sin nada que sustituir");

        assert.equal(valor.value(), "Sin nada que sustituir");
        assert.equal(valor.value({}), "Sin nada que sustituir");
    });

    it("no toca las llaves que no son un parámetro declarado", () => {
        const valor = new SingularValue<{a: string}>("{{a}} pero no {{b}}", ["a"]);

        assert.equal(valor.value({a: "sí"}), "sí pero no {{b}}");
    });
});
