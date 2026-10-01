import {describe, it} from "node:test";
import assert from "node:assert/strict";

import {Linter} from "eslint";

import config from "../config.js";
import plugin from "../index.js";

const PROPIAS = Object.keys(plugin.rules).sort();

/**
 * **Esto no prueba reglas, prueba que las listas no se desincronicen**, que es un fallo distinto y
 * que ningún `RuleTester` puede ver: una regla nueva del plugin que nadie añade a una configuración
 * funciona perfectamente y no la ejecuta nadie.
 */
describe("configuraciones del plugin", () => {
    for (const nombre of ["recomendada", "estricta"]) {
        it(`\`${nombre}\` activa todas las reglas del plugin, y ninguna que no exista`, () => {
            const activas = Object.keys(plugin.configs[nombre].rules).map((r) => r.slice("mrpack/".length));
            assert.deepEqual(activas.sort(), PROPIAS);
        });
    }
});

describe("configuración del monorepo", () => {
    const principal = config.find((bloque) => bloque.rules?.["mrpack/import-blocks"] !== undefined);

    it("activa todas las reglas del plugin", () => {
        const activas = Object.keys(principal.rules).filter((r) => r.startsWith("mrpack/")).map((r) => r.slice("mrpack/".length));
        assert.deepEqual(activas.sort(), PROPIAS);
    });

    it("no le pasa a import-blocks una lista de workspaces escrita, para que la deduzca", () => {
        const valor = principal.rules["mrpack/import-blocks"];
        const opciones = Array.isArray(valor) ? valor[1] : undefined;
        assert.equal(opciones?.workspaces, undefined);
    });

    it("registra typescript-eslint en lugar de dar por hecho que lo hace el consumidor", () => {
        assert.ok(principal.plugins["@typescript-eslint"]);
        const usadas = Object.keys(principal.rules).filter((r) => r.startsWith("@typescript-eslint/"));
        for (const regla of usadas) {
            assert.ok(principal.plugins["@typescript-eslint"].rules[regla.slice("@typescript-eslint/".length)], regla);
        }
    });
});

/**
 * El selector que sustituye a `no-var` es esquery escrito a mano, que es justo lo que se rompe sin
 * avisar: un selector mal escrito no da error, simplemente no casa con nada.
 */
describe("el `var` de verdad, sí; el ambiental, no", () => {
    const linter = new Linter({configType: "flat"});
    const avisos = (codigo) => linter.verify(codigo, config, {filename: "ejemplo.ts"})
        .filter((mensaje) => mensaje.ruleId === "no-restricted-syntax")
        .map((mensaje) => mensaje.line);

    it("deja pasar `declare var`, `declare global` y `declare namespace`", () => {
        assert.deepEqual(avisos("declare var A: boolean;\ndeclare global {\n    var B: string;\n}\ndeclare namespace N {\n    var C: number;\n}\nexport {};\n"), []);
    });

    it("denuncia el `var` suelto, el de una función y el de un `for`", () => {
        assert.deepEqual(avisos("var a = 1;\nexport function f(): number {\n    var b = 2;\n    for (var i = 0; i < 1; i++) {\n        b += i;\n    }\n    return a + b;\n}\n"), [1, 3, 4]);
    });
});
