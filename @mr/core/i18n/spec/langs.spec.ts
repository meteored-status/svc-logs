/**
 * Editor: Bixus
 * Fecha: Thu, 17 Sep 2026 14:19:23 GMT
 * Hash: 0755041e2a625532ae896b316bdacc5d
 * Versión: 2026.9.17+2-bixus
 * Anterior: 2026.9.16+1-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

import {describe, it} from "node:test";
import assert from "node:assert/strict";

import {corto, soportado, soportados} from "../modules/langs";
import type {Idioma} from "../modules/langs";

/**
 * `corto()` reduce un idioma a su subetiqueta primaria. Es la pieza con la que se agrupan las variantes, y
 * equivocarse aquí no rompe nada visible: devuelve otro código que **también** está soportado, así que el
 * error viaja aguas abajo disfrazado de acierto.
 */
describe("corto", () => {

    it("corta por el separador, no por los dos primeros caracteres", () => {
        assert.equal(corto("es-ES"), "es");
        assert.equal(corto("pt-BR"), "pt");
        assert.equal(corto("en"), "en");
    });

    it("un código de tres letras se devuelve entero", () => {
        // `slice(0, 2)` lo convertía en "fi", que es finés y está soportado: ni lanzaba, ni devolvía
        // undefined, ni dejaba de ser un IdiomaCorto válido. El cambiazo era indetectable.
        assert.equal(corto("fil"), "fil");
        assert.notEqual(corto("fil"), "fi");
    });

    it("lo que devuelve es siempre un idioma soportado por sí mismo", () => {
        // Es la propiedad de la que se fía todo lo de aguas abajo: agrupar por `corto()` no puede inventar
        // un idioma que no exista.
        for (const idioma of soportados) {
            assert.equal(soportados.includes(corto(idioma)), true, idioma);
        }
    });
});

/**
 * `soportado()` es la guarda de la lista blanca: el único sitio donde una cadena de fuera se convierte en
 * un `Idioma`.
 */
describe("soportado", () => {

    it("acepta una cadena cualquiera, sin cast delante", () => {
        const deFuera: string = "pt-BR";
        assert.equal(soportado(deFuera), true);
        assert.equal(soportado("zh-CN"), false);
        assert.equal(soportado(""), false);
    });

    it("distingue la caja, porque la lista blanca la fija", () => {
        // No es una comparación BCP 47 —esa la hace `getLang()`—, es pertenencia a una lista escrita a mano.
        assert.equal(soportado("es-ES"), true);
        assert.equal(soportado("es-es"), false);
    });

    it("estrecha el tipo, que es para lo que existe", () => {
        const deFuera: string = "ca";
        if (soportado(deFuera)) {
            // Si esto no compilara, la guarda no estaría haciendo su trabajo.
            const idioma: Idioma = deFuera;
            assert.equal(corto(idioma), "ca");
        } else {
            assert.fail("'ca' debería estar soportado");
        }
    });
});
