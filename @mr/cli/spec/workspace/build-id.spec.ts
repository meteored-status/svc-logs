/**
 * Editor: Bixus
 * Fecha: Mon, 09 Nov 2026 16:33:45 GMT
 * Hash: fed500eab34ba6cb9c6792116ad1a9a4
 * Versión: 2026.11.9+15-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

import {describe, it} from "node:test";
import assert from "node:assert/strict";

import {leerBuildId, md5Fichero} from "../../src/clases/workspace/build-id";

describe("md5Fichero", () => {
    // Valor que da `md5Dir()` de `@mr/core-cli/fs` sobre un `.next/BUILD_ID` con ese contenido. No se
    // llama aquí a `md5Dir()`: el arnés no puede cargar `@mr/core-cli` (sus imports relativos van sin
    // extensión). La comparación con el `md5Dir()` real la hace `packNextJS` tras cada `next build`.
    it("da lo mismo que md5Dir para un BUILD_ID", () => {
        assert.equal(md5Fichero("/ws/.next/BUILD_ID", "a75c0b60284ed1ad70b40027ae79fa0d"), "fd3ebefe297a1cac14c68919a73c58d5");
    });

    it("solo cuenta el nombre del fichero, no su directorio", () => {
        assert.equal(md5Fichero("/a/BUILD_ID", "x"), md5Fichero("/b/c/BUILD_ID", "x"));
    });

    it("depende del contenido", () => {
        assert.notEqual(md5Fichero("/x/BUILD_ID", "uno"), md5Fichero("/x/BUILD_ID", "dos"));
    });
});

describe("leerBuildId", () => {
    it("toma el id de la marca aunque el next.config escriba antes", () => {
        assert.equal(leerBuildId("cargando config\notra línea\n@@BUILD_ID@@abc123\n"), "abc123");
    });

    it("sin marca no hay id", () => {
        assert.equal(leerBuildId("cargando config\n"), undefined);
        assert.equal(leerBuildId(""), undefined);
    });

    it("una marca vacía no es un id", () => {
        assert.equal(leerBuildId("\n@@BUILD_ID@@  \n"), undefined);
    });
});
