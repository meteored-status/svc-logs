/**
 * Editor: Bixus
 * Fecha: Thu, 03 Sep 2026 06:58:23 GMT
 * Hash: 8f84f3d040510a8c0e4e9e1ca0dd437c
 * Versión: 2026.9.3+1-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

import {describe, it} from "node:test";
import assert from "node:assert/strict";

import {SingularValue} from "../../../modules/traduccion/v2/value/singular-value";
import {TranslationMap} from "../../../modules/traduccion/v2/translation-map";

/**
 * El mapa es lo que usan los catálogos con clave —severidades de log, rótulos de menú, nombres de área—,
 * donde el código elige la clave y la traducción pone el texto.
 */

const dias = () => new TranslationMap<"lun"|"mar">({
    lun: new SingularValue("Lunes"),
    mar: new SingularValue("Martes"),
});

describe("TranslationMap", () => {

    it("devuelve el texto de la clave", () => {
        assert.equal(dias().get("lun"), "Lunes");
        assert.equal(dias().get("mar"), "Martes");
    });

    it("una clave que no está devuelve la clave, no una cadena vacía", () => {
        // Es la red de seguridad del catálogo: si a un idioma le falta una entrada se ve cuál, en vez de
        // quedarse un hueco en blanco en pantalla.
        const mapa = dias() as TranslationMap<string>;

        assert.equal(mapa.get("noexiste"), "noexiste");
    });

    it("uGet acepta claves sin comprobar el tipo, incluidas numéricas", () => {
        const mapa = new TranslationMap<string>({
            "1": new SingularValue("Uno"),
        });

        assert.equal(mapa.uGet(1), "Uno");
        assert.equal(mapa.uGet("1"), "Uno");
    });

    it("pasa los parámetros al valor elegido", () => {
        const mapa = new TranslationMap<"saludo", {nombre: string}>({
            saludo: new SingularValue("Hola {{nombre}}", ["nombre"]),
        });

        assert.equal(mapa.get("saludo", {nombre: "Jose"}), "Hola Jose");
    });

    it("size, keys y values recorren el catálogo entero", () => {
        const mapa = dias();

        assert.equal(mapa.size, 2);
        assert.deepEqual(mapa.keys(), ["lun", "mar"]);
        assert.deepEqual(mapa.values(), ["Lunes", "Martes"]);
    });

    it("orderValues respeta el orden pedido y no el de declaración", () => {
        assert.deepEqual(dias().orderValues(["mar", "lun"]), ["Martes", "Lunes"]);
    });
});
