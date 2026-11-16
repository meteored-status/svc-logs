/**
 * Editor: Juan C. Martínez
 * Fecha: Wed, 11 Nov 2026 10:30:11 GMT
 * Hash: 04e4c281275298cae734ab29f241a85e
 * Versión: 2026.11.11+2-juancmartinez
 * Proyecto: git@github.com:alpred/meteored-svc-panel-usuarios.git
 */

import {describe, it} from "node:test";
import assert from "node:assert/strict";

import ts from "typescript";

import {patronDeRegex, tsToJSON} from "../../src/clases/auto-doc/literal";
import {crearProgramaVirtual, RAIZ} from "./programa-virtual";

/**
 * Evalúa `valor` como inicializador de `const resultado = valor;` en un `main.ts` virtual con el contexto
 * `contexto` delante.
 */
function evaluar(valor: string, contexto: string = ""): unknown {
    const programa = crearProgramaVirtual({[`${RAIZ}/main.ts`]: `${contexto}\nconst resultado = ${valor};\nexport {resultado};\n`});
    const fichero = programa.getSourceFile(`${RAIZ}/main.ts`)!;
    let salida: unknown = "no encontrado";
    ts.forEachChild(fichero, (n) => {
        if (ts.isVariableStatement(n)) {
            const decl = n.declarationList.declarations.find(d => ts.isIdentifier(d.name) && d.name.text === "resultado");
            if (decl?.initializer !== undefined) {
                salida = tsToJSON(decl.initializer, programa.getTypeChecker());
            }
        }
    });

    return salida;
}

describe("tsToJSON", () => {
    it("convierte literales primitivos y negativos", () => {
        assert.equal(evaluar(`"a"`), "a");
        assert.equal(evaluar("`sin sustituciones`"), "sin sustituciones");
        assert.equal(evaluar("7"), 7);
        assert.equal(evaluar("-3"), -3);
        assert.equal(evaluar("true"), true);
        assert.equal(evaluar("false"), false);
    });

    it("desenvuelve as const, satisfies y paréntesis", () => {
        assert.deepEqual(evaluar(`({a: 1} as const)`), {a: 1});
        assert.deepEqual(evaluar(`{a: ["x"]} satisfies object`), {a: ["x"]});
        assert.equal(evaluar(`("x")`), "x");
    });

    it("resuelve plantillas y sumas con constantes", () => {
        assert.equal(evaluar("`${BASE}/page`", `const BASE = "/private";`), "/private/page");
        assert.equal(evaluar(`BASE + "/x"`, `const BASE = "/p";`), "/p/x");
        assert.equal(evaluar("`${fuera()}/x`", `declare function fuera(): string;`), null);
    });

    it("resuelve identificadores, propiedades de constantes y miembros de enum", () => {
        assert.equal(evaluar("RUTAS.base", `const RUTAS = {base: "/b"};`), "/b");
        assert.equal(evaluar("E.A", `enum E {A = "valor"}`), "valor");
        assert.equal(evaluar("N", `const N = 5;`), 5);
    });

    it("solo resuelve variables const: el valor de un let o var puede cambiar", () => {
        assert.equal(evaluar("L", `let L = "/l";`), null);
        assert.equal(evaluar("V", `var V = "/v";`), null);
        assert.equal(evaluar("C", `const C = "/c";`), "/c");
    });

    it("resuelve propiedades abreviadas y spread", () => {
        assert.deepEqual(evaluar("{a, ...otro}", `const a = 1; const otro = {b: 2};`), {a: 1, b: 2});
    });

    it("solo trata buildSpecification como transparente", () => {
        assert.deepEqual(evaluar(`buildSpecification({a: 1})`, `declare function buildSpecification<T>(x: T): T;`), {a: 1});
        assert.equal(evaluar(`otra({a: 1})`, `declare function otra<T>(x: T): T;`), null);
    });

    it("devuelve las regex como su texto literal, también las de new RegExp", () => {
        assert.equal(evaluar(`/^\\d+$/i`), "/^\\d+$/i");
        assert.equal(evaluar("new RegExp(`^${B}/x$`)", `const B = "/p";`), "/^/p/x$/");
        assert.equal(evaluar(`new RegExp(variable)`, `declare const variable: string;`), null);
    });

    it("no se cuelga con constantes circulares", () => {
        assert.equal(evaluar("a", `const b: string = a as string; const a: string = b;`), null);
    });
});

describe("patronDeRegex", () => {
    it("quita barras y flags", () => {
        assert.equal(patronDeRegex("/^\\d+$/i"), "^\\d+$");
        assert.equal(patronDeRegex("/a\\/b/"), "a\\/b");
    });

    it("deja tal cual lo que no es un literal", () => {
        assert.equal(patronDeRegex("^abc$"), "^abc$");
    });
});
