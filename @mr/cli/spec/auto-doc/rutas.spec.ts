/**
 * Editor: Juan C. Martínez
 * Fecha: Thu, 12 Nov 2026 11:55:33 GMT
 * Hash: 2097128ffb64f79cc9b111f7801d0965
 * Versión: 2026.11.12+1-juancmartinez
 * Anterior: 2026.11.11+2-juancmartinez
 * Proyecto: git@github.com:alpred/meteored-svc-panel-intranet.git
 */

import {describe, it} from "node:test";
import assert from "node:assert/strict";

import {expandirOpcionales, parametrosDe, separarQuery} from "../../src/clases/auto-doc/rutas";
import {IMPORT_RG, rutasDe} from "./programa-virtual";

/** `metodo path` de todas las operaciones del resultado. */
function listar(codigo: string, extra: Record<string, string> = {}): string[] {
    return rutasDe(IMPORT_RG + codigo, extra).grupos.flatMap(g => g.operaciones.map(o => `${o.metodo} ${o.path}`));
}

describe("expandirOpcionales / parametrosDe", () => {
    it("expande {x?} en con y sin segmento", () => {
        assert.deepEqual(expandirOpcionales("/a/{x?}"), ["/a/{x}", "/a"]);
        assert.deepEqual(expandirOpcionales("/a"), ["/a"]);
        assert.deepEqual(expandirOpcionales("/{x?}"), ["/{x}", "/"]);
    });

    it("con dos opcionales saca el producto", () => {
        assert.deepEqual(expandirOpcionales("/a/{x?}/{y?}"), ["/a/{x}/{y}", "/a/{x}", "/a/{y}", "/a"]);
    });

    it("lista los nombres de parámetro", () => {
        assert.deepEqual(parametrosDe("/a/{x}/b/{y}"), ["x", "y"]);
    });
});

describe("separarQuery", () => {
    it("corta en el primer «?» fuera de llaves y saca los nombres sin repetir", () => {
        assert.deepEqual(separarQuery("/a/?country=18&x={y}&country=2"), {path: "/a/", query: ["country", "x"]});
        assert.deepEqual(separarQuery("/t/{z}/{f}{s}.json?tz={timezone}"), {path: "/t/{z}/{f}{s}.json", query: ["tz"]});
    });

    it("el «?» de {x?} es un segmento opcional, no una query", () => {
        assert.deepEqual(separarQuery("/a/{x?}"), {path: "/a/{x?}"});
        assert.deepEqual(separarQuery("/a/{x?}?y=1"), {path: "/a/{x?}", query: ["y"]});
    });
});

describe("resumen con query string o sin «/» inicial", () => {
    const grupo = (resumen: string, extra = ""): string => `
class G extends RouteGroup {
    protected getHandlers(): IRouteGroup[] { return [{expresiones: [{metodos: ["GET"], resumen: ${JSON.stringify(resumen)}, regex: /^\\/x$/, ${extra}}]}]; }
}`;

    it("el path no lleva «?» y cada k={v} es un parámetro query obligatorio, con aviso", () => {
        const {grupos, avisos} = rutasDe(IMPORT_RG + grupo("/asistente/?country=18&lang={l}"));
        const operacion = grupos[0].operaciones[0];
        assert.equal(operacion.path, "/asistente/");
        assert.deepEqual(operacion.queryPath, ["country", "lang"]);
        assert.equal(avisos.length, 1);
        assert.match(avisos[0].mensaje, /lleva query string/);
    });

    it("las llaves del path siguen siendo parámetros de path y {x?} se expande", () => {
        const {grupos} = rutasDe(IMPORT_RG + grupo("/t/{z}/{x?}.json?tz={timezone}"));
        assert.deepEqual(grupos[0].operaciones.map(o => [o.path, o.parametros, o.queryPath]), [
            ["/t/{z}/{x}.json", ["z", "x"], ["tz"]],
            ["/t/{z}.json", ["z"], ["tz"]],
        ]);
    });

    it("antepone «/» si falta y no parece una expresión regular, con aviso", () => {
        const {grupos, avisos} = rutasDe(IMPORT_RG + grupo(".well-known/atproto-did/{pais}"));
        assert.equal(grupos[0].operaciones[0].path, "/.well-known/atproto-did/{pais}");
        assert.equal(avisos.length, 1);
        assert.match(avisos[0].mensaje, /no empieza por «\/»: se documenta como «\/\.well-known/);
    });

    it("sin «/» y con pinta de regex, se omite", () => {
        const {grupos, avisos} = rutasDe(IMPORT_RG + grupo("^/a/(\\d+)$"));
        assert.deepEqual(grupos[0].operaciones, []);
        assert.match(avisos[0].mensaje, /parece una expresión regular/);
    });
});

describe("extraerRutas", () => {
    it("fusiona métodos y bloques distintos de un grupo", () => {
        const salida = listar(`
class G extends RouteGroup {
    protected getHandlers(): IRouteGroup[] {
        return [
            {expresiones: [{metodos: ["GET", "POST"], exact: "/a", resumen: "/a"}]},
            {expresiones: [{metodos: ["DELETE"], exact: "/a", resumen: "/a"}, {metodos: ["GET"], exact: "/b", resumen: "/b"}]},
        ];
    }
}`);
        assert.deepEqual(salida, ["get /a", "post /a", "delete /a", "get /b"]);
    });

    it("ALL o sin métodos documentan get, post, put, patch y delete; HEAD solo si es explícito", () => {
        const todos = ["get /a", "post /a", "put /a", "patch /a", "delete /a"];
        const base = (metodos: string): string => `
class G extends RouteGroup {
    protected getHandlers(): IRouteGroup[] { return [{expresiones: [{${metodos} exact: "/a", resumen: "/a"}]}]; }
}`;
        assert.deepEqual(listar(base(`metodos: ["ALL"],`)), todos);
        assert.deepEqual(rutasDe(IMPORT_RG + base(`metodos: ["ALL"],`)).avisos, []);
        assert.deepEqual(listar(base(``)), todos);
        assert.deepEqual(listar(base(`metodos: [],`)), todos);
        assert.deepEqual(listar(base(`metodos: ["HEAD", "GET"],`)), ["head /a", "get /a"]);
    });

    it("usa exact si existe y, si no, resumen; expande {x?}", () => {
        const salida = listar(`
class G extends RouteGroup {
    protected getHandlers(): IRouteGroup[] {
        return [{expresiones: [
            {metodos: ["GET"], regex: /^\\/r\\/([a-z]+)$/, resumen: "/r/{id}"},
            {metodos: ["GET"], exact: "/e", resumen: "otra cosa"},
            {metodos: ["GET"], regex: /x/, resumen: "/o/{x?}"},
        ]}];
    }
}`);
        assert.deepEqual(salida, ["get /r/{id}", "get /e", "get /o/{x}", "get /o"]);
    });

    it("resuelve resumen con plantillas de constantes", () => {
        const salida = listar(`
const BASE = "/priv";
class G extends RouteGroup {
    protected getHandlers(): IRouteGroup[] {
        return [{expresiones: [{metodos: ["GET"], exact: \`\${BASE}/page\`, resumen: \`\${BASE}/page\`}]}];
    }
}`);
        assert.deepEqual(salida, ["get /priv/page"]);
    });

    it("documenta internal con la marca internal, y deprecated", () => {
        const {grupos} = rutasDe(IMPORT_RG + `
class G extends RouteGroup {
    protected getHandlers(): IRouteGroup[] {
        return [{expresiones: [
            {metodos: ["GET"], exact: "/i", resumen: "/i", internal: true, deprecated: true},
            {metodos: ["GET"], exact: "/p", resumen: "/p"},
        ]}];
    }
}`);
        const [i, p] = grupos[0].operaciones;
        assert.equal(i.internal, true);
        assert.equal(i.deprecated, true);
        assert.equal(p.internal, false);
        assert.equal(p.deprecated, false);
    });

    it("un internal que no es un booleano literal se documenta como interno, con aviso", () => {
        const {grupos, avisos} = rutasDe(IMPORT_RG + `
declare const PRODUCCION: boolean;
const INTERNA = true;
class G extends RouteGroup {
    protected getHandlers(): IRouteGroup[] {
        return [{expresiones: [
            {metodos: ["GET"], exact: "/a", resumen: "/a", internal: !PRODUCCION},
            {metodos: ["GET"], exact: "/b", resumen: "/b", internal: PRODUCCION ? false : true},
            {metodos: ["GET"], exact: "/c", resumen: "/c", internal: INTERNA},
            {metodos: ["GET"], exact: "/d", resumen: "/d", internal: false},
        ]}];
    }
}`);
        assert.deepEqual(grupos[0].operaciones.map(o => [o.path, o.internal]), [["/a", true], ["/b", true], ["/c", true], ["/d", false]]);
        assert.equal(avisos.length, 2);
        assert.ok(avisos.every(a => /«internal» no es un booleano literal: se documenta como interna/.test(a.mensaje)));
    });

    it("excluye documentable:false del bloque y del super()", () => {
        const salida = listar(`
class Bloque extends RouteGroup {
    protected getHandlers(): IRouteGroup[] {
        return [
            {documentable: false, expresiones: [{metodos: ["GET"], exact: "/oculta", resumen: "/oculta"}]},
            {expresiones: [{metodos: ["GET"], exact: "/visible", resumen: "/visible"}]},
        ];
    }
}
class Super extends RouteGroup {
    constructor(config: unknown) { super(config, {documentable: false}); }
    protected getHandlers(): IRouteGroup[] { return [{expresiones: [{metodos: ["GET"], exact: "/oculta2", resumen: "/oculta2"}]}]; }
}
class Admin extends RouteGroup {
    protected getHandlers(): IRouteGroup[] { return [{expresiones: [{metodos: ["GET"], exact: "/admin/x", resumen: "/admin/x"}]}]; }
}`);
        assert.deepEqual(salida, ["get /visible"]);
    });

    it("detecta subclases indirectas y de RouteGroupError, pero no una clase propia llamada RouteGroup", () => {
        const {grupos, avisos} = rutasDe(IMPORT_RG + `
import {RouteGroup as Falso} from "falso/group";
abstract class Intermedia extends RouteGroup {}
class Hija extends Intermedia {
    protected getHandlers(): IRouteGroup[] { return [{expresiones: [{metodos: ["GET"], exact: "/hija", resumen: "/hija"}]}]; }
}
class Manejador extends RouteGroupError {
    protected getHandlers(): IRouteGroup[] { return [{expresiones: [{metodos: ["GET"], exact: "/error", resumen: "/error"}]}]; }
}
class Impostora extends Falso {
    protected getHandlers(): never[] { return []; }
}`);
        assert.deepEqual(grupos.map(g => g.nombre), ["Intermedia", "Hija", "Manejador"]);
        assert.deepEqual(grupos.map(g => g.operaciones.length), [0, 1, 1]);
        assert.equal(avisos.length, 1);
        assert.match(avisos[0].mensaje, /Impostora extiende una clase «RouteGroup» declarada en .*falso\/group\.ts/);
        assert.match(avisos[0].ubicacion ?? "", /^main\.ts:\d+$/);
    });

    it("avisa, con ubicación, de lo que no puede leer en vez de descartarlo", () => {
        const {grupos, avisos} = rutasDe(IMPORT_RG + `
declare function construir(): IRouteGroup[];
declare const dinamica: string;
class NoLiteral extends RouteGroup {
    protected getHandlers(): IRouteGroup[] { return construir(); }
}
class ResumenDinamico extends RouteGroup {
    protected getHandlers(): IRouteGroup[] { return [{expresiones: [{metodos: ["GET"], exact: dinamica, resumen: dinamica}]}]; }
}
class ExpresionesDinamicas extends RouteGroup {
    protected getHandlers(): IRouteGroup[] { return [{expresiones: [1].map(() => ({metodos: ["GET"], exact: "/x", resumen: "/x"}))}]; }
}`);
        assert.deepEqual(grupos.flatMap(g => g.operaciones), []);
        assert.equal(avisos.length, 3);
        for (const aviso of avisos) {
            assert.equal(aviso.severidad, "aviso");
            assert.match(aviso.ubicacion ?? "", /^main\.ts:\d+$/);
        }
        assert.match(avisos[0].mensaje, /NoLiteral\.getHandlers no devuelve un array literal/);
        assert.match(avisos[1].mensaje, /ni «exact» ni «resumen» son literales/);
        assert.match(avisos[2].mensaje, /«expresiones» no es un array literal/);
    });

    it("lee todos los return de getHandlers", () => {
        const salida = listar(`
class G extends RouteGroup {
    private flag = true;
    protected getHandlers(): IRouteGroup[] {
        if (this.flag) {
            return [{expresiones: [{metodos: ["GET"], exact: "/a", resumen: "/a"}]}];
        }
        return [{expresiones: [{metodos: ["GET"], exact: "/b", resumen: "/b"}]}];
    }
}`);
        assert.deepEqual(salida, ["get /a", "get /b"]);
    });

    it("resuelve getHandlers, bloques y expresiones declarados como constantes", () => {
        const salida = listar(`
const EXPRESIONES = [{metodos: ["GET"], exact: "/c", resumen: "/c"}];
const BLOQUE = {expresiones: EXPRESIONES};
class G extends RouteGroup {
    protected getHandlers(): IRouteGroup[] { return [BLOQUE]; }
}`);
        assert.deepEqual(salida, ["get /c"]);
    });

    it("avisa de una ruta repetida y se queda con la primera", () => {
        const {grupos, avisos} = rutasDe(IMPORT_RG + `
class G extends RouteGroup {
    protected getHandlers(): IRouteGroup[] {
        return [{expresiones: [{metodos: ["GET"], exact: "/a", resumen: "primera"}, {metodos: ["GET"], exact: "/a", resumen: "segunda"}]}];
    }
}`);
        assert.equal(grupos[0].operaciones.length, 1);
        assert.equal(grupos[0].operaciones[0].resumen, "primera");
        assert.equal(avisos.length, 1);
        assert.match(avisos[0].mensaje, /GET \/a está repetida/);
    });

    it("lee los specs literales y avisa del que no lo es", () => {
        const {grupos, avisos} = rutasDe(IMPORT_RG + `
declare function spec(): Record<string, unknown>;
class G extends RouteGroup {
    protected getHandlers(): IRouteGroup[] {
        return [{expresiones: [{metodos: ["POST"], exact: "/a", resumen: "/a", query: {q: {regex: /^\\d+$/, opcional: true}}, post: spec()}]}];
    }
}`);
        assert.deepEqual(grupos[0].operaciones[0].query, {q: {regex: "/^\\d+$/", opcional: true}});
        assert.equal(grupos[0].operaciones[0].post, undefined);
        assert.match(avisos[0].mensaje, /«post» no es un objeto literal/);
    });
});
