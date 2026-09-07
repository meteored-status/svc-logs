/**
 * Editor: Bixus
 * Fecha: Mon, 07 Sep 2026 13:12:27 GMT
 * Hash: 239aa4b43c8108a5fdbda6b36aebb51a
 * Versión: 2026.9.7+1-bixus
 * Anterior: 2026.9.3+1-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

import {describe, it} from "node:test";
import assert from "node:assert/strict";

import {getLang} from "../modules/util/lang";

/**
 * `getLang` decide con qué idioma se carga un módulo. Es la pieza donde un descuido no da error de
 * compilación y sí un texto en el idioma equivocado —o un módulo que no existe—.
 */
describe("getLang", () => {

    it("normaliza el separador: es-ES, es_ES y esES son el mismo idioma", () => {
        assert.equal(getLang(["esES"], "es-ES"), "esES");
        assert.equal(getLang(["esES"], "es_ES"), "esES");
        assert.equal(getLang(["esES"], "esES"), "esES");
    });

    it("si el idioma pedido no está, usa el que se pase por defecto", () => {
        assert.equal(getLang(["esES", "frFR"], "de-DE", "es-ES"), "esES");
    });

    it("prefiere el idioma pedido antes que el de por defecto", () => {
        assert.equal(getLang(["esES", "frFR"], "fr-FR", "es-ES"), "frFR");
    });

    it("sin idioma por defecto cae en 'enUS', exista o no en el módulo", () => {
        // Este es el motivo de que el idioma por defecto sea obligatorio al cargar una traducción: cuando
        // no llega, esto devuelve un 'enUS' fijo que la mayoría de los módulos de este panel no declaran
        // —son es/en/fr, con 'enGB'—, y lo que revienta después es la carga, ya lejos de aquí.
        assert.equal(getLang(["esES", "frFR"], "de-DE"), "enUS");
        assert.equal(getLang([], "de-DE"), "enUS");
    });

    it("un idioma por defecto que tampoco está tampoco salva: sigue cayendo en 'enUS'", () => {
        assert.equal(getLang(["esES"], "de-DE", "pt-PT"), "enUS");
    });
});
