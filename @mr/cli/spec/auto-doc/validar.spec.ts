/**
 * Editor: Juan C. Martínez
 * Fecha: Wed, 11 Nov 2026 10:30:11 GMT
 * Hash: 04e3287ead3748d50247dc3d29c56bed
 * Versión: 2026.11.11+2-juancmartinez
 * Proyecto: git@github.com:alpred/meteored-svc-panel-usuarios.git
 */

import {describe, it} from "node:test";
import assert from "node:assert/strict";

import type {IOpenAPI, IPath} from "services-comun/modules/openapi/interface";

import {validarOpenAPI} from "../../src/clases/auto-doc/validar";

function doc(paths: Record<string, IPath>, schemas: Record<string, object> = {}): IOpenAPI {
    return {openapi: "3.1.0", info: {title: "svc", version: "1", description: ""}, servers: [], paths, components: {schemas}};
}

const OK_ID = {operationId: "get_a", responses: {"200": {description: "ok"}}};

describe("validarOpenAPI", () => {
    it("acepta un documento correcto", () => {
        const salida = validarOpenAPI(doc({
            "/a/{id}": {get: {...OK_ID, parameters: [{name: "id", in: "path", required: true, schema: {type: "string"}}]}},
        }));
        assert.deepEqual(salida, []);
    });

    it("rechaza paths con «?» o sin «/» inicial", () => {
        const salida = validarOpenAPI(doc({"/a?x": {}, "b": {}}));
        assert.equal(salida.length, 2);
        assert.ok(salida.every(s => s.severidad === "error"));
        assert.match(salida[0].mensaje, /contiene «\?»/);
        assert.match(salida[1].mensaje, /no empieza por «\/»/);
    });

    it("exige que cada {param} esté declarado in: path y obligatorio", () => {
        const sin = validarOpenAPI(doc({"/a/{id}": {get: OK_ID}}));
        assert.match(sin[0].mensaje, /«\{id\}» no está declarado/);

        const opcional = validarOpenAPI(doc({"/a/{id}": {get: {...OK_ID, parameters: [{name: "id", in: "path", required: false}]}}}));
        assert.equal(opcional.length, 1);

        const enQuery = validarOpenAPI(doc({"/a/{id}": {get: {...OK_ID, parameters: [{name: "id", in: "query", required: true}]}}}));
        assert.equal(enQuery.length, 1);
    });

    it("comprueba que todo $ref resuelve", () => {
        const roto = validarOpenAPI(doc({"/a": {get: {...OK_ID, responses: {"200": {description: "ok", content: {"application/json": {schema: {$ref: "#/components/schemas/Falta"}}}}}}}}));
        assert.equal(roto.length, 1);
        assert.match(roto[0].mensaje, /\$ref «#\/components\/schemas\/Falta» sin resolver/);

        const bien = validarOpenAPI(doc(
            {"/a": {get: {...OK_ID, responses: {"200": {description: "ok", content: {"application/json": {schema: {$ref: "#/components/schemas/Existe"}}}}}}}},
            {Existe: {type: "object"}},
        ));
        assert.deepEqual(bien, []);
    });

    it("detecta operationId y parámetros repetidos", () => {
        const salida = validarOpenAPI(doc({
            "/a": {get: OK_ID},
            "/b": {get: {...OK_ID, parameters: [{name: "q", in: "query"}, {name: "q", in: "query"}]}},
        }));
        assert.equal(salida.length, 2);
        assert.match(salida[0].mensaje, /«get_a» repetido|parámetro query:q/);
    });

    it("comprueba que todo security referencia un esquema declarado", () => {
        const sin = validarOpenAPI(doc({"/a": {get: {...OK_ID, security: [{Falta: []}]}}}));
        assert.equal(sin.length, 1);
        assert.match(sin[0].mensaje, /esquema de seguridad «Falta»/);

        const con = doc({"/a": {get: {...OK_ID, security: [{Existe: []}, {}]}}});
        con.components!.securitySchemes = {Existe: {type: "apiKey", in: "header", name: "Authorization"}};
        assert.deepEqual(validarOpenAPI(con), []);
    });

    it("sitúa los errores de una operación con su ubicación", () => {
        const ubicaciones = new Map([["get /a/{id}", "src/g.ts:12"]]);
        const salida = validarOpenAPI(doc({"/a/{id}": {get: OK_ID}}), ubicaciones);
        assert.equal(salida.length, 1);
        assert.equal(salida[0].ubicacion, "src/g.ts:12");
        assert.equal(validarOpenAPI(doc({"/a/{id}": {get: OK_ID}}))[0].ubicacion, undefined);
    });
});
