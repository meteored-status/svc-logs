import {describe, it} from "node:test";
import assert from "node:assert/strict";

import {parsearResourceName} from "../modules/net/resource";

describe("parsearResourceName", () => {

    it("descompone el resourceName de una notificación de Cloud Storage", () => {
        assert.deepEqual(parsearResourceName("projects/_/buckets/cf-accesos/objects/tiempo-es/20260101/log.json.gz"), {
            bucket: "cf-accesos",
            path: "tiempo-es/20260101/log.json.gz",
        });
    });

    it("conserva la ruta completa aunque contenga el separador", () => {
        assert.deepEqual(parsearResourceName("projects/_/buckets/cf-accesos/objects/mr/objects/raro.json"), {
            bucket: "cf-accesos",
            path: "mr/objects/raro.json",
        });
    });

    it("rechaza un resourceName con otro prefijo en vez de cortar el bucket por el sitio equivocado", () => {
        assert.equal(parsearResourceName("projects/mi-proyecto/buckets/cf-accesos/objects/mr/log.json"), undefined);
        assert.equal(parsearResourceName("//storage.googleapis.com/projects/_/buckets/cf-accesos/objects/mr/log.json"), undefined);
    });

    it("rechaza un resourceName sin objeto", () => {
        assert.equal(parsearResourceName("projects/_/buckets/cf-accesos"), undefined);
        assert.equal(parsearResourceName("projects/_/buckets/cf-accesos/objects/"), undefined);
    });

    it("rechaza un bucket vacío", () => {
        assert.equal(parsearResourceName("projects/_/buckets//objects/mr/log.json"), undefined);
    });

    it("rechaza cadenas vacías o sin relación", () => {
        assert.equal(parsearResourceName(""), undefined);
        assert.equal(parsearResourceName("cualquier cosa"), undefined);
    });
});
