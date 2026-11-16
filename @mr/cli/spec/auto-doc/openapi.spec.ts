/**
 * Editor: Juan C. Martínez
 * Fecha: Wed, 11 Nov 2026 10:30:11 GMT
 * Hash: 598e28ba17274590c6c541c6f98a9573
 * Versión: 2026.11.11+2-juancmartinez
 * Proyecto: git@github.com:alpred/meteored-svc-panel-usuarios.git
 */

import {describe, it} from "node:test";
import assert from "node:assert/strict";

import {construirOpenAPI} from "../../src/clases/auto-doc/openapi";
import {validarOpenAPI} from "../../src/clases/auto-doc/validar";
import {IMPORT_RG, rutasDe} from "./programa-virtual";

function generar(codigo: string): ReturnType<typeof construirOpenAPI> {
    return construirOpenAPI(rutasDe(IMPORT_RG + codigo).grupos, {name: "svc"});
}

const CODIGO = `
class Usuarios extends RouteGroup {
    protected getHandlers(): IRouteGroup[] {
        return [
            {expresiones: [
                {metodos: ["GET"], exact: "/u/{id}", resumen: "/u/{id}", documentacion: {descripcion: "Ficha"}, query: {
                    tipo: {options: ["a", "b"]},
                    modo: {exact: "x", opcional: true},
                    codigo: {regex: /^[A-Z]+$/i, description: "Código"},
                }},
                {metodos: ["POST", "PUT"], exact: "/u/{id}", resumen: "/u/{id}", post: {
                    nombre: {type: "string", required: true, description: "Nombre", regexp: /^\\w+$/},
                    edad: {type: "number", required: false, description: "Edad"},
                    tags: {type: "array", required: false, description: "Tags", items: {type: "string", required: true, description: ""}},
                    datos: {type: "object", required: true, description: "Datos", properties: {a: {type: "boolean", required: true, description: "A"}}},
                    id: {type: "string", required: true, description: "id", postType: "path"},
                }},
                {metodos: ["DELETE"], exact: "/u/{id}", resumen: "/u/{id}", deprecated: true, internal: true, headers: {"x-key": {type: "string", required: true, description: "clave"}, "x-opc": {type: "string", required: false, description: "opcional"}}, response: {ok: {type: "boolean", required: true, description: "ok"}}},
            ]},
            {expresiones: [{metodos: ["GET"], regex: /^\\/l(?:\\/([0-9]+))?$/, resumen: "/l/{n?}"}]},
        ];
    }
}
class Vacia extends RouteGroup {
    protected getHandlers(): IRouteGroup[] { return [{documentable: false, expresiones: []}]; }
}`;

describe("construirOpenAPI", () => {
    const doc = generar(CODIGO);

    it("fusiona los métodos de un path en un solo IPath", () => {
        assert.deepEqual(Object.keys(doc.paths!["/u/{id}"]), ["get", "post", "put", "delete"]);
        assert.deepEqual(Object.keys(doc.paths!), ["/u/{id}", "/l/{n}", "/l"]);
    });

    it("declara los parámetros de path y expande {x?}", () => {
        assert.deepEqual(doc.paths!["/u/{id}"].get!.parameters![0], {name: "id", in: "path", required: true, schema: {type: "string"}});
        assert.deepEqual(doc.paths!["/l/{n}"].get!.parameters, [{name: "n", in: "path", required: true, schema: {type: "string"}}]);
        assert.equal(doc.paths!["/l"].get!.parameters, undefined);
    });

    it("traduce los parámetros de query: enum, const, pattern y requerido", () => {
        const [, tipo, modo, codigo] = doc.paths!["/u/{id}"].get!.parameters!;
        assert.deepEqual(tipo, {name: "tipo", in: "query", required: true, schema: {enum: ["a", "b"], type: "string"}});
        assert.deepEqual(modo, {name: "modo", in: "query", required: false, schema: {const: "x", type: "string"}});
        assert.deepEqual(codigo, {name: "codigo", in: "query", required: true, schema: {type: "string", pattern: "^[A-Z]+$"}, description: "Código"});
    });

    it("emite requestBody en POST/PUT con regexp, anidados y sin campos de path; no en GET", () => {
        const cuerpo = doc.paths!["/u/{id}"].post!.requestBody!.content["application/json"].schema;
        assert.deepEqual(cuerpo, {
            type: "object",
            properties: {
                nombre: {type: "string", pattern: "^\\w+$", description: "Nombre"},
                edad: {type: "number", description: "Edad"},
                tags: {type: "array", description: "Tags", items: {type: "string"}},
                datos: {type: "object", description: "Datos", properties: {a: {type: "boolean", description: "A"}}, required: ["a"]},
            },
            required: ["nombre", "datos"],
        });
        assert.deepEqual(doc.paths!["/u/{id}"].put!.requestBody, doc.paths!["/u/{id}"].post!.requestBody);
        assert.equal(doc.paths!["/u/{id}"].get!.requestBody, undefined);
        assert.equal(doc.paths!["/u/{id}"].delete!.requestBody, undefined);
    });

    it("marca deprecated y x-internal, y usa headers requeridos y response", () => {
        const borrar = doc.paths!["/u/{id}"].delete!;
        assert.equal(borrar.deprecated, true);
        assert.equal(borrar["x-internal"], true);
        assert.equal(doc.paths!["/u/{id}"].get!["x-internal"], undefined);
        assert.deepEqual(borrar.parameters![1], {name: "x-key", in: "header", required: true, schema: {type: "string"}, description: "clave"});
        assert.equal((borrar.parameters![2] as {required: boolean}).required, false);
        assert.deepEqual(borrar.responses!["200"].content!["application/json"].schema, {type: "object", properties: {ok: {type: "boolean", description: "ok"}}, required: ["ok"]});
    });

    it("usa la descripción documentada como summary y, si no, el resumen; siempre hay respuesta 200", () => {
        assert.equal(doc.paths!["/u/{id}"].get!.summary, "Ficha");
        assert.equal(doc.paths!["/u/{id}"].post!.summary, "/u/{id}");
        assert.deepEqual(doc.paths!["/l"].get!.responses, {"200": {description: "Respuesta correcta"}});
    });

    it("genera operationId únicos y deterministas", () => {
        assert.equal(doc.paths!["/u/{id}"].get!.operationId, "get_u_id");
        assert.equal(doc.paths!["/l"].get!.operationId, "get_l");
    });

    it("solo crea tags de grupos con operaciones, uno por clase", () => {
        assert.deepEqual(doc.tags, [{name: "Usuarios", description: "Rutas de Usuarios"}]);
    });

    it("la salida es determinista y pasa la validación", () => {
        assert.equal(JSON.stringify(generar(CODIGO)), JSON.stringify(doc));
        assert.deepEqual(validarOpenAPI(doc), []);
    });
});

describe("construirOpenAPI: query string del resumen", () => {
    const {grupos} = rutasDe(IMPORT_RG + `
class G extends RouteGroup {
    protected getHandlers(): IRouteGroup[] {
        return [{expresiones: [
            {metodos: ["GET"], resumen: "/a/?country=18&tz={t}", query: {tz: {type: "string", opcional: true, description: "Zona"}}},
        ]}];
    }
}`);
    const doc = construirOpenAPI(grupos, {name: "svc"});

    it("los parámetros del query string son query obligatorios, sin duplicar los ya declarados", () => {
        assert.deepEqual(Object.keys(doc.paths!), ["/a/"]);
        assert.deepEqual(doc.paths!["/a/"].get!.parameters, [
            {name: "tz", in: "query", required: false, schema: {type: "string"}, description: "Zona"},
            {name: "country", in: "query", required: true, schema: {type: "string"}},
        ]);
        assert.deepEqual(validarOpenAPI(doc), []);
    });
});
