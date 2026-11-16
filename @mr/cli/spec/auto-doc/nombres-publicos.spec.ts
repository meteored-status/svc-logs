/**
 * Editor: Juan C. Martínez
 * Fecha: Thu, 12 Nov 2026 11:55:33 GMT
 * Hash: 2107dc3816ec4d520086cac400438959
 * Versión: 2026.11.12+1-juancmartinez
 * Proyecto: git@github.com:alpred/meteored-svc-panel-intranet.git
 */

import {describe, it} from "node:test";
import assert from "node:assert/strict";

import type {IOpenAPI} from "services-comun/modules/openapi/interface";

import {construirOpenAPI} from "../../src/clases/auto-doc/openapi";
import {esPrivada} from "../../src/clases/auto-doc/visibilidad";
import {validarOpenAPI} from "../../src/clases/auto-doc/validar";
import {IMPORT_RG, rutasDe} from "./programa-virtual";

type TObjeto = Record<string, unknown>;

const IMPORT_CONTRATO = `import {Contract} from "@mr/core-network/server/http/routes/group/contract";\n`;

/** Dos `IProductOffer` distintos, como en panel-usuarios-backend: el de catálogo (público) y el de BI (privado). */
const TIPOS = {
    "/v/catalogo/oferta.ts": "export interface IProductOffer {precio: number}\nexport interface IExtra {publico: boolean}",
    "/v/bi/oferta.ts": "export interface IProductOffer {accion: string}\nexport interface IExtra {privado: boolean}",
};

const IMPORTS_TIPOS = `import type {IProductOffer as OfertaCatalogo, IExtra as ExtraCatalogo} from "./catalogo/oferta";
import type {IProductOffer as OfertaBI, IExtra as ExtraBI} from "./bi/oferta";
`;

/** Grupo público: `GET /catalog/public`, con `Authorization` documentada. */
const CATALOGO = `
interface IHeadersCatalogo {
    /** Token del usuario. */
    authorization: string;
}
class Catalogo extends RouteGroup {
    protected getHandlers(): IRouteGroup[] {
        return [{expresiones: [
            {metodos: ["GET"], exact: "/catalog/public", resumen: "/catalog/public", contract: Contract<{response: OfertaCatalogo; query: {extra?: ExtraCatalogo}; headers: IHeadersCatalogo}>()},
            {metodos: ["GET"], exact: "/a_b", resumen: "/a_b"},
        ]}];
    }
}`;

/** Grupo privado: path bajo `/private/` y una expresión `internal: true` cuyo slug choca con `/a_b`. */
const BI = `
interface IHeadersBI {
    /** Token de servicio (privado). */
    authorization: string;
}
class BI extends RouteGroup {
    protected getHandlers(): IRouteGroup[] {
        return [{expresiones: [
            {metodos: ["POST"], exact: "/private/bi/execute", resumen: "/private/bi/execute", contract: Contract<{post: OfertaBI; response: ExtraBI; headers: IHeadersBI}>()},
            {metodos: ["GET"], exact: "/a-b", resumen: "/a-b", internal: true, contract: Contract<{response: OfertaBI}>()},
        ]}];
    }
}`;

/** Genera el documento `all` con los grupos en el orden dado. */
function generar(...grupos: string[]): IOpenAPI {
    const rutas = rutasDe(`${IMPORT_RG}${IMPORT_CONTRATO}${IMPORTS_TIPOS}${grupos.join("\n")}`, TIPOS);

    return construirOpenAPI(rutas.grupos, {name: "svc"}, rutas.componentes);
}

function esObjeto(valor: unknown): valor is TObjeto {
    return typeof valor === "object" && valor !== null && !Array.isArray(valor);
}

function recogerRefs(valor: unknown, salida: Set<string>): void {
    if (Array.isArray(valor)) {
        for (const elemento of valor) {
            recogerRefs(elemento, salida);
        }
    } else if (esObjeto(valor)) {
        for (const [clave, hijo] of Object.entries(valor)) {
            if (clave === "$ref" && typeof hijo === "string") {
                salida.add(hijo.replace("#/components/schemas/", ""));
            } else {
                recogerRefs(hijo, salida);
            }
        }
    }
}

/**
 * Lo esencial del filtro `public` de doc-backend (`filtrarOpenApi`): fuera las operaciones con `x-internal` o bajo
 * `/private/`, y de `components` solo lo alcanzable desde lo que queda.
 */
function publico(doc: IOpenAPI): TObjeto {
    const copia = JSON.parse(JSON.stringify(doc)) as TObjeto;
    const paths: TObjeto = {};
    for (const [path, item] of Object.entries(copia["paths"] as TObjeto)) {
        const nuevo: TObjeto = {};
        for (const [metodo, operacion] of Object.entries(item as TObjeto)) {
            if (!(esObjeto(operacion) && operacion["x-internal"] === true) && path !== "/private" && !path.startsWith("/private/")) {
                nuevo[metodo] = operacion;
            }
        }
        if (Object.keys(nuevo).length > 0) {
            paths[path] = nuevo;
        }
    }

    const componentes = copia["components"] as {schemas: Record<string, unknown>; securitySchemes?: TObjeto};
    const usados = new Set<string>();
    const pendientes = new Set<string>();
    recogerRefs(paths, pendientes);
    while (pendientes.size > 0) {
        const [nombre] = pendientes;
        pendientes.delete(nombre);
        if (!usados.has(nombre)) {
            usados.add(nombre);
            recogerRefs(componentes.schemas[nombre], pendientes);
        }
    }
    const schemas: TObjeto = {};
    for (const nombre of [...usados].sort()) {
        schemas[nombre] = componentes.schemas[nombre];
    }

    return {paths, components: {schemas, securitySchemes: componentes.securitySchemes}};
}

describe("nombres del documento público: no dependen de las operaciones privadas", () => {
    const soloPublico = publico(generar(CATALOGO));
    const privadoPrimero = generar(BI, CATALOGO);
    const publicoPrimero = generar(CATALOGO, BI);

    it("con el homónimo privado antes, el público se queda el nombre limpio y el privado lleva el sufijo", () => {
        const schemas = privadoPrimero.components!.schemas!;
        assert.deepEqual(schemas["IProductOffer"].properties, {precio: {type: "number"}});
        assert.deepEqual(schemas["IProductOffer_bi_oferta"].properties, {accion: {type: "string"}});
        assert.deepEqual(schemas["IExtra"].properties, {publico: {type: "boolean"}});
        assert.deepEqual(schemas["IExtra_bi_oferta"].properties, {privado: {type: "boolean"}});
        assert.deepEqual(validarOpenAPI(privadoPrimero), []);
    });

    it("con el homónimo público antes, el resultado es el mismo", () => {
        assert.deepEqual(publicoPrimero.components, privadoPrimero.components);
        assert.deepEqual(validarOpenAPI(publicoPrimero), []);
    });

    it("el operationId sin sufijo es el de la operación pública aunque la privada llegue antes", () => {
        assert.equal(privadoPrimero.paths!["/a_b"].get!.operationId, "get_a_b");
        assert.equal(privadoPrimero.paths!["/a-b"].get!.operationId, "get_a_b_2");
        assert.equal(publicoPrimero.paths!["/a_b"].get!.operationId, "get_a_b");
    });

    it("la description de IdToken es la de la operación pública aunque la privada llegue antes", () => {
        assert.equal(privadoPrimero.components!.securitySchemes!["IdToken"].description, "Token del usuario.");
    });

    it("filtrado a público, es idéntico con o sin las operaciones privadas y en cualquier orden", () => {
        assert.deepEqual(Object.keys((soloPublico["components"] as {schemas: TObjeto}).schemas), ["IExtra", "IProductOffer", "RespuestaOK_IProductOffer"]);
        assert.deepEqual(publico(privadoPrimero), soloPublico);
        assert.deepEqual(publico(publicoPrimero), soloPublico);
    });

    it("las paths siguen en el orden del código", () => {
        assert.deepEqual(Object.keys(privadoPrimero.paths!), ["/private/bi/execute", "/a-b", "/catalog/public", "/a_b"]);
        assert.deepEqual(Object.keys(publicoPrimero.paths!), ["/catalog/public", "/a_b", "/private/bi/execute", "/a-b"]);
    });
});

describe("nombres del documento público: el orden de los ficheros no decide entre homónimos públicos", () => {
    const IMPORTS_GRUPO = `${IMPORT_RG}${IMPORT_CONTRATO}${IMPORTS_TIPOS.replaceAll("./", "../")}`;
    const ficheros = {
        ...TIPOS,
        "/v/grupos/catalogo.ts": `${IMPORTS_GRUPO}${CATALOGO}`,
        "/v/grupos/b.ts": `${IMPORTS_GRUPO}
class CatalogoB extends RouteGroup {
    protected getHandlers(): IRouteGroup[] {
        return [{expresiones: [{metodos: ["GET"], exact: "/b/catalog", resumen: "/b/catalog", contract: Contract<{response: OfertaBI}>()}]}];
    }
}`,
    };

    it("entre dos homónimos públicos gana el de la primera operación por path, se descubra antes un fichero u otro", () => {
        const a = rutasDe(`import "./grupos/catalogo";\nimport "./grupos/b";\n`, ficheros);
        const b = rutasDe(`import "./grupos/b";\nimport "./grupos/catalogo";\n`, ficheros);
        // Los ficheros se descubren en otro orden: si no, la prueba no probaría nada.
        assert.deepEqual(a.grupos.map(g => g.nombre), ["Catalogo", "CatalogoB"]);
        assert.deepEqual(b.grupos.map(g => g.nombre), ["CatalogoB", "Catalogo"]);
        assert.deepEqual(a.componentes, b.componentes);
        assert.deepEqual(a.componentes["IProductOffer"].properties, {accion: {type: "string"}});
        assert.deepEqual(a.componentes["IProductOffer_catalogo_oferta"].properties, {precio: {type: "number"}});
    });

    it("los tags salen por nombre, se descubra antes un fichero u otro", () => {
        const a = rutasDe(`import "./grupos/b";\nimport "./grupos/catalogo";\n`, ficheros);
        const b = rutasDe(`import "./grupos/catalogo";\nimport "./grupos/b";\n`, ficheros);
        const tags = (r: typeof a): string[] => (construirOpenAPI(r.grupos, {name: "svc"}, r.componentes).tags ?? []).map(t => t.name);
        assert.deepEqual(tags(a), ["Catalogo", "CatalogoB"]);
        assert.deepEqual(tags(b), ["Catalogo", "CatalogoB"]);
    });
});

describe("nombres del documento público: casos borde", () => {
    it("esPrivada sigue el criterio de doc-backend: internal, /private y lo que cuelga de él", () => {
        const op = (path: string, internal = false): {path: string; internal: boolean} => ({path, internal});
        assert.equal(esPrivada(op("/private")), true);
        assert.equal(esPrivada(op("/private/x")), true);
        assert.equal(esPrivada(op("/x", true)), true);
        assert.equal(esPrivada(op("/privatex")), false);
        assert.equal(esPrivada(op("/api/private/x")), false);
        assert.equal(esPrivada(op("/")), false);
    });

    it("un contrato de bloque que comparten una expresión privada (antes) y una pública es público", () => {
        const bloque = (expresiones: string): string => `
class Mixto extends RouteGroup {
    protected getHandlers(): IRouteGroup[] {
        return [{contract: Contract<{response: OfertaBI}>(), expresiones: [${expresiones}]}];
    }
}`;
        const privada = `{metodos: ["GET"], exact: "/private/m", resumen: "/private/m"}`;
        const publica = `{metodos: ["GET"], exact: "/z", resumen: "/z"}`;
        const con = generar(bloque(`${privada}, ${publica}`), CATALOGO);
        const sin = generar(bloque(publica), CATALOGO);
        assert.deepEqual(publico(con), publico(sin));
        assert.deepEqual(con.components!.schemas!["IProductOffer"].properties, {precio: {type: "number"}});
        assert.equal(con.paths!["/z"].get!.responses!["200"].content!["application/json"].schema!.$ref, "#/components/schemas/RespuestaOK_IProductOffer_bi_oferta");
    });

    it("el contrato de una expresión con todas sus rutas repetidas se lee al final y no le quita el nombre a nadie", () => {
        const repetida = `
class Repetida extends RouteGroup {
    protected getHandlers(): IRouteGroup[] {
        return [{expresiones: [{metodos: ["GET"], exact: "/a_b", resumen: "/a_b", contract: Contract<{response: OfertaBI}>()}]}];
    }
}`;
        const rutas = rutasDe(`${IMPORT_RG}${IMPORT_CONTRATO}${IMPORTS_TIPOS}
class Previa extends RouteGroup {
    protected getHandlers(): IRouteGroup[] {
        return [{expresiones: [{metodos: ["GET"], exact: "/0", resumen: "/0", contract: Contract<{response: OfertaCatalogo}>()}]}];
    }
}
${CATALOGO}${repetida}`, TIPOS);
        assert.ok(rutas.avisos.some(a => /GET \/a_b está repetida/.test(a.mensaje)));
        assert.deepEqual(rutas.grupos.find(g => g.nombre === "Repetida")!.operaciones, []);
        assert.deepEqual(rutas.componentes["IProductOffer"].properties, {precio: {type: "number"}});
        assert.deepEqual(rutas.componentes["IProductOffer_bi_oferta"].properties, {accion: {type: "string"}});
    });

    it("en una unión, quién se queda el nombre limpio no depende de lo que el checker resolvió antes", () => {
        const tipos = {
            "/v/a.ts": "export interface IItem {a: string}\nexport interface IRamaA {tipo: \"a\"; item: IItem}",
            "/v/b.ts": "export interface IItem {b: number}\nexport interface IRamaB {tipo: \"b\"; item: IItem}",
        };
        const cabecera = `${IMPORT_RG}${IMPORT_CONTRATO}import type {IRamaA} from "./a";\nimport type {IRamaB} from "./b";\n`;
        const pub = `
class Pub extends RouteGroup {
    protected getHandlers(): IRouteGroup[] {
        return [{expresiones: [{metodos: ["GET"], exact: "/x", resumen: "/x", contract: Contract<{response: IRamaA | IRamaB}>()}]}];
    }
}`;
        // Cambios solo privados (o ajenos a la API) que hacen que el checker cree antes los tipos de IRamaB.
        const privado = `
class Priv extends RouteGroup<IRamaB> {
    protected getHandlers(): IRouteGroup[] {
        return [{expresiones: [{metodos: ["GET"], exact: "/private/y", resumen: "/private/y"}]}];
    }
}`;
        const noAPI = "class Base<T> { public v?: T; }\nclass Cosa extends Base<IRamaB> {}\n";
        const documento = (codigo: string): IOpenAPI => {
            const rutas = rutasDe(codigo, tipos);

            return construirOpenAPI(rutas.grupos, {name: "svc"}, rutas.componentes);
        };
        const base = publico(documento(cabecera + pub));
        assert.deepEqual((base["components"] as {schemas: Record<string, {properties?: unknown}>}).schemas["IItem"].properties, {a: {type: "string"}});
        assert.deepEqual(publico(documento(cabecera + privado + pub)), base);
        assert.deepEqual(publico(documento(cabecera + pub + privado)), base);
        assert.deepEqual(publico(documento(cabecera + noAPI + pub)), base);
    });

    it("tampoco con los homónimos envueltos: arrays, tuplas, genéricos y Record", () => {
        const tipos = {
            "/v/a.ts": "export interface IItem {a: string}",
            "/v/b.ts": "export interface IItem {b: number}",
        };
        const cabecera = `${IMPORT_RG}${IMPORT_CONTRATO}import type {IItem as IA} from "./a";\nimport type {IItem as IB} from "./b";
interface ICaja<T> {valor: T}
type TPar<T> = {primero: T; segundo: T};
interface IZ {z: boolean}
`;
        const formas = [
            "IA[] | IB[]",
            "[IA] | [IB]",
            "ICaja<IA> | ICaja<IB>",
            "TPar<IA> | TPar<IB>",
            "Record<string, IA> | Record<string, IB>",
            "(IA | null)[] | (IB | null)[]",
            "ICaja<IA[]> | ICaja<IB[]>",
            "(IA | IZ)[] | (IB | IZ)[]",
            "(IZ | IA)[] | (IB | IZ)[]",
            "ICaja<IA | IZ> | ICaja<IB | IZ>",
        ];
        for (const forma of formas) {
            const pub = `
class Pub extends RouteGroup {
    protected getHandlers(): IRouteGroup[] {
        return [{expresiones: [{metodos: ["GET"], exact: "/x", resumen: "/x", contract: Contract<{response: ${forma}}>()}]}];
    }
}`;
            // Una clase ajena a la API que hace que el checker cree antes los tipos de la rama B.
            const noAPI = `class Base<T> { public v?: T; }\nclass Cosa extends Base<${forma.split(" | ")[1]}> {}\n`;
            const documento = (codigo: string): TObjeto => {
                const rutas = rutasDe(codigo, tipos);

                return publico(construirOpenAPI(rutas.grupos, {name: "svc"}, rutas.componentes));
            };
            const base = documento(cabecera + pub);
            assert.deepEqual((base["components"] as {schemas: Record<string, {properties?: unknown}>}).schemas["IItem"].properties, {a: {type: "string"}}, forma);
            assert.deepEqual(documento(cabecera + noAPI + pub), base, forma);
        }
    });
});
