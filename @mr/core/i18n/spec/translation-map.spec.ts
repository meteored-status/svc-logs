/**
 * Editor: Bixus
 * Fecha: Mon, 07 Sep 2026 13:12:27 GMT
 * Hash: fd8ff16e98fc6c3ddd8e5c6e7cfb453b
 * Versión: 2026.9.7+1-bixus
 * Anterior: 2026.9.3+1-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

import {describe, it} from "node:test";
import assert from "node:assert/strict";

import {SingularValue} from "../modules/value/singular-value";
import {TranslationMap} from "../modules/translation-map";

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
