/**
 * Editor: Bixus
 * Fecha: Mon, 09 Nov 2026 07:46:18 GMT
 * Hash: 147a849a3ce2f1468f73324b91b2bff1
 * Versión: 2026.11.9+2-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

import {describe, it} from "node:test";
import assert from "node:assert/strict";

import {conAutoria, stripAutoria, versionAutoria} from "../../src/clases/paquete/autoria";

const CUERPO = ["export type TParams = Record<string, string|number>;", "", "export const x = 1;", ""];

/**
 * Un bloque de autoría como los que escribe el envío.
 *
 * @param version - Versión del bloque.
 * @param eol - Salto de línea.
 * @returns El bloque, con la línea en blanco final.
 */
function bloque(version: string, eol: string): string {
    return ["/**", " * Editor: Bixus", " * Fecha: Sat, 07 Nov 2026 00:38:09 GMT", " * Hash: c8dc8e61864eaa0752d5de91c4be2629", ` * Versión: ${version}`, " * Proyecto: https://github.com/bixus/bixloader", " */", "", ""].join(eol);
}

describe("bloque de autoría", () => {
    for (const [nombre, eol] of [["LF", "\n"], ["CRLF", "\r\n"]]) {
        const cuerpo = CUERPO.join(eol);

        it(`${nombre}: stripAutoria quita el bloque, y también los apilados`, () => {
            assert.equal(stripAutoria(bloque("2026.11.7+1-bixus", eol) + cuerpo), cuerpo);
            assert.equal(stripAutoria(bloque("2026.11.7+1-bixus", eol) + bloque("2026.9.23+1-bixus", eol) + cuerpo), cuerpo);
        });

        it(`${nombre}: versionAutoria devuelve la versión sin el fin de línea`, () => {
            assert.equal(versionAutoria(bloque("2026.9.23+1-bixus", eol) + cuerpo), "2026.9.23+1-bixus");
        });

        it(`${nombre}: re-estampar deja una sola cabecera, con el fin de línea del fichero`, () => {
            const original = bloque("2026.9.23+1-bixus", eol) + cuerpo;
            const nuevo = conAutoria(stripAutoria(original), {autor: "Bixus", fecha: new Date(0), hash: "h", version: "2026.11.9+1-bixus", anterior: versionAutoria(original), proyecto: "p"});

            assert.equal((nuevo.match(/ \* Editor: /g) ?? []).length, 1);
            assert.match(nuevo, / \* Anterior: 2026\.9\.23\+1-bixus\r?\n/);
            assert.equal(stripAutoria(nuevo), cuerpo);
            assert.equal(nuevo.includes("\r\n"), eol==="\r\n", "no mezcla saltos de línea");
            if (eol==="\n") {
                assert.ok(!nuevo.includes("\r"));
            } else {
                assert.ok(!/[^\r]\n/.test(nuevo), "todo CRLF");
            }
        });
    }

    it("sin `anterior` ni `proyecto` no escribe esas líneas", () => {
        const nuevo = conAutoria("x\n", {autor: "a", fecha: new Date(0), hash: "h", version: "v", proyecto: ""});
        assert.equal(nuevo, `/**\n * Editor: a\n * Fecha: ${new Date(0).toUTCString()}\n * Hash: h\n * Versión: v\n */\n\nx\n`);
    });
});
