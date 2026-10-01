/**
 * Editor: Juan C. Martínez
 * Fecha: Mon, 28 Sep 2026 06:38:15 GMT
 * Hash: 310d2e6edc68801620cd0edc101e4b57
 * Versión: 2026.9.28+1-juancmartinez
 * Anterior: 2026.9.23+1-bixus
 * Proyecto: git@github.com:alpred/meteored-svc-panel-frontend.git
 */

import {describe, it} from "node:test";
import assert from "node:assert/strict";
import ts from "typescript";

/**
 * `json.ts` importa `@mr/core-cli/fs` (solo para `ModuloJSON.load()`, que este spec no usa) y ese
 * import revienta al ejecutarse aquí: `@mr/core-cli/modules/fs.ts` importa `./log` sin extensión, y
 * fuera del bundle de esbuild —que es donde corre `mrlang` de verdad— nada resuelve esa ruta relativa,
 * así que Node muere con un `unhandledRejection`/excepción no capturada al cargar el módulo, antes de
 * que se ejecute ni una sola prueba. No es un fallo de este cambio: ningún spec de este workspace había
 * importado nunca nada de `src/clases-v2/`, que es justo lo que depende de `@mr/core-cli`.
 *
 * `stub()` precarga `require.cache` con la ruta ya resuelta de `especificador` *antes* de que nada la
 * importe, así que `require()` la sirve desde caché y no llega a intentar cargar el `.ts` real. No hace
 * falta que las funciones stub hagan nada: `generateLangIndex()`, `validar()` y los emisores no llaman a
 * ninguna — están aquí solo para que el `import {isFile, readJSON} from "@mr/core-cli/fs";` de la
 * cabecera de `json.ts` no falle al resolverse.
 */
function stub(especificador: string, exportado: Record<string, unknown>): void {
    const resuelto = require.resolve(especificador);
    require.cache[resuelto] = {
        id: resuelto,
        filename: resuelto,
        loaded: true,
        exports: exportado,
    } as unknown as NodeModule;
}

stub("@mr/core-cli/fs", {
    isFile: async () => false,
    readJSON: async () => ({}),
});

import {ModuloJSON} from "../src/clases-v2/modulo/json";
import {Definition} from "../src/clases-v2/modulo/definition";
import generateLiteral from "../src/clases-v2/modulo/translation/literal";
import generateMap from "../src/clases-v2/modulo/translation/map";
import generateSet from "../src/clases-v2/modulo/translation/set";
import type {IEntradaEmitida} from "../src/clases-v2/modulo/translation/common";
import type {JSONItem, JSONValorMap, JSONValorSet, JSONValue} from "../src/clases-v2/data";

// Imports "muertos", solo para que `tsc` compile estos ficheros a `tmp/spec/modules/*.js`: ninguna
// otra prueba de este workspace los importa (las demás cubren `translation-{map,set}`, `value/*` y
// `util/*`, pero no `literal.ts` ni el `index.ts` de `value/`), y la prueba de más abajo que ejecuta
// el `index.ts` generado los pide con un `require()` cuya cadena es dinámica — invisible para `tsc`,
// que solo compila lo que ve en un `import`/`require` estático — así que sin esto el `.js` no existe
// todavía cuando el `require()` en tiempo de ejecución lo busca.
import "../modules/literal";
import "../modules/value/singular-value";
import "../modules/value/plural-value";
import "../modules/util/plural-function-builder";
import "../modules/translation-map";
import "../modules/translation-set";

/**
 * Un `ModuloJSON` construido a mano, sin pasar por `ModuloJSON.load()` (que lee de disco). El
 * constructor de `Modulo`/`ModuloJSON` es `protected` —no se puede hacer `new ModuloJSON(...)` desde
 * fuera—, pero `_original` y `config` son privacidad solo de TypeScript: en tiempo de ejecución son
 * propiedades normales, así que un objeto que las tenga puestas se comporta como una instancia real
 * para `name()`, `path()`, `traducciones()`, `validar()` y `generateLangIndex()`, que es todo lo que
 * usan estas pruebas.
 */
function crearModulo(traducciones: JSONItem[], {id = "modulo_prueba", relativePath = "/spec"}: {id?: string; relativePath?: string} = {}): ModuloJSON {
    const instancia: Record<string, unknown> = Object.create(ModuloJSON.prototype);
    instancia["_original"] = {id, version: 2, traducciones};
    instancia["config"] = {jsondir: "/spec", relativePath};

    return instancia as unknown as ModuloJSON;
}

/**
 * Emite las entradas de un módulo para un idioma, igual que hace `Generate.generateModule()`: una
 * entrada por `id`, con el emisor que le toca según `tipo`. Sin `resolverValor()` —el valor del
 * idioma pedido siempre está puesto a mano en los datos de prueba, así que no hace falta la cadena de
 * fallback— y sin `Generate` en medio, que es justo lo que este spec no puede importar (ver el
 * `describe` de más abajo sobre por qué).
 */
function emitirEntradas(modulo: ModuloJSON, lang: string, definition: Definition): Map<string, IEntradaEmitida> {
    const entradas = new Map<string, IEntradaEmitida>();

    for (const item of modulo.traducciones()) {
        const valor = item.values.valor[lang];
        switch (item.tipo) {
            case "literal":
                entradas.set(item.id, generateLiteral(lang, valor as JSONValue, item, modulo, definition));
                break;
            case "map":
                entradas.set(item.id, generateMap(lang, valor as JSONValorMap, item, modulo, definition));
                break;
            case "set":
                entradas.set(item.id, generateSet(lang, valor as JSONValorSet, item, modulo, definition));
                break;
        }
    }

    return entradas;
}

/** Un literal simple, uno con params, un plural con `counter` explícito, un map y un set — los cinco casos que pide cubrir la tarea. */
const TRADUCCIONES: JSONItem[] = [
    {
        id: "saludo",
        origen: "interno",
        tipo: "literal",
        values: {valor: {es: {type: "singular", value: "Hola"}}},
    },
    {
        id: "bienvenida",
        origen: "interno",
        tipo: "literal",
        params: ["nombre"],
        values: {valor: {es: {type: "singular", value: "Hola {{nombre}}"}}},
    },
    {
        id: "dias_restantes",
        origen: "interno",
        tipo: "literal",
        params: ["dias", "total"],
        counter: "dias",
        values: {valor: {es: {type: "plural", value: {
            one: "Queda {{dias}} de {{total}} día",
            other: "Quedan {{dias}} de {{total}} días",
        }}}},
    },
    {
        id: "estado",
        origen: "interno",
        tipo: "map",
        params: ["n"],
        values: {valor: {es: {valores: {
            activo: {type: "singular", value: "{{n}} activo"},
            inactivo: {type: "singular", value: "{{n}} inactivo"},
        }}}},
    },
    {
        id: "colores",
        origen: "interno",
        tipo: "set",
        params: ["n"],
        values: {valor: {es: {valores: [
            {type: "singular", value: "Rojo"},
            {type: "singular", value: "{{n}} verdes"},
        ]}}},
    },
];

describe("generateLangIndex()", () => {

    it("no importa ningún fichero hermano, una IIFE por entrada, imports sin duplicar y TypeScript válido", () => {
        const modulo = crearModulo(TRADUCCIONES);
        const definition = new Definition(modulo.id, "/definitions", modulo.path(), ["es"]);
        const entradas = emitirEntradas(modulo, "es", definition);

        const salida = modulo.generateLangIndex(entradas);

        // Lo que hacía el esquema de un fichero por clave y ya no: `import x from "./x";`.
        assert.equal(salida.includes(`from "./`), false, "no debería quedar ningún import a un fichero hermano");

        for (const item of TRADUCCIONES) {
            assert.match(salida, new RegExp(`const ${item.id} = \\(\\(\\) => \\{`), `falta la IIFE de "${item.id}"`);
        }

        const lineasImport = salida.split("\n").filter(linea => linea.startsWith("import "));
        assert.deepEqual(lineasImport, Array.from(new Set(lineasImport)), "no debería haber una línea de import repetida");

        const {diagnostics} = ts.transpileModule(salida, {
            reportDiagnostics: true,
            compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022},
        });
        assert.deepEqual(diagnostics, [], "el index.ts generado tiene que ser TypeScript sintácticamente válido");
    });

    it("los valores que renderiza el index.ts generado son los que declaró el .json", () => {
        const modulo = crearModulo(TRADUCCIONES);
        const definition = new Definition(modulo.id, "/definitions", modulo.path(), ["es"]);
        const entradas = emitirEntradas(modulo, "es", definition);
        const salida = modulo.generateLangIndex(entradas);

        // Transpila (no typecheck de programa completo, `transpileModule` no resuelve módulos) y ejecuta
        // el resultado con un `require` que solo conoce el runtime real de `@mr/core-i18n` — cualquier
        // otro import es, por definición, uno que `generateLangIndex()` no debería haber escrito.
        const {outputText, diagnostics} = ts.transpileModule(salida, {
            reportDiagnostics: true,
            compilerOptions: {module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022},
        });
        assert.deepEqual(diagnostics, []);

        const RUNTIME: Record<string, string> = {
            "@mr/core-i18n/literal": "../modules/literal",
            "@mr/core-i18n/value/singular-value": "../modules/value/singular-value",
            "@mr/core-i18n/value/plural-value": "../modules/value/plural-value",
            "@mr/core-i18n/util/plural-function-builder": "../modules/util/plural-function-builder",
            "@mr/core-i18n/translation-map": "../modules/translation-map",
            "@mr/core-i18n/translation-set": "../modules/translation-set",
        };
        // `any` a propósito: `exports.default` es la instancia de una clase que solo existe en el código
        // generado y transpilado en tiempo de ejecución, no hay ningún tipo estático que ponerle aquí.
        const moduloEjecutado: {exports: any} = {exports: {}};
        const requireFalso = (especificador: string): unknown => {
            const ruta = RUNTIME[especificador];
            if (ruta == undefined) {
                throw new Error(`import inesperado en el index.ts generado: "${especificador}"`);
            }
            return require(ruta);
        };

        const fabrica = new Function("exports", "require", "module", outputText);
        fabrica(moduloEjecutado.exports, requireFalso, moduloEjecutado);

        const instancia = moduloEjecutado.exports.default;

        assert.equal(instancia.saludo, "Hola");
        assert.equal(instancia.bienvenida({nombre: "Juan"}), "Hola Juan");
        assert.equal(instancia.dias_restantes({dias: 1, total: 5}), "Queda 1 de 5 día");
        assert.equal(instancia.dias_restantes({dias: 3, total: 5}), "Quedan 3 de 5 días");
        assert.equal(instancia.estado.get("activo", {n: 3}), "3 activo");
        assert.equal(instancia.estado.get("inactivo", {n: 1}), "1 inactivo");
        assert.deepEqual(instancia.colores.allValues({n: 3}), ["Rojo", "3 verdes"]);
    });
});

describe("validar() — nombres que chocan con lo que genera el index.ts", () => {

    it("un id que es palabra reservada de JavaScript", () => {
        const modulo = crearModulo([
            {id: "public", origen: "interno", tipo: "literal", values: {valor: {es: {type: "singular", value: "x"}}}},
        ]);

        const problemas = modulo.validar();

        assert.ok(problemas.some(p => p.includes(`"public"`) && p.includes("palabra reservada")), problemas.join("\n"));
    });

    it("un id que no es identificador de JavaScript, pero no uno con tildes", () => {
        const modulo = crearModulo([
            {id: "1dia", origen: "interno", tipo: "literal", values: {valor: {es: {type: "singular", value: "x"}}}},
            {id: "un-envio", origen: "interno", tipo: "literal", values: {valor: {es: {type: "singular", value: "x"}}}},
            {id: "cerrar_sesión", origen: "interno", tipo: "literal", values: {valor: {es: {type: "singular", value: "x"}}}},
        ]);

        const problemas = modulo.validar().filter(p => p.includes("identificador"));

        assert.equal(problemas.length, 2, problemas.join("\n"));
        assert.ok(problemas.some(p => p.includes(`"1dia"`)), problemas.join("\n"));
        assert.ok(problemas.some(p => p.includes(`"un-envio"`)), problemas.join("\n"));
    });

    it("un id que coincide con un nombre que la cabecera del index.ts ya usa", () => {
        const modulo = crearModulo([
            {id: "Literal", origen: "interno", tipo: "literal", values: {valor: {es: {type: "singular", value: "x"}}}},
        ]);

        const problemas = modulo.validar();

        assert.ok(problemas.some(p => p.includes(`"Literal"`)), problemas.join("\n"));
    });

    it("el nombre del módulo en PascalCase coincide con un nombre fijo", () => {
        // pascalCase("literal") == "Literal", que es el tipo que Literal.ts importa de @mr/core-i18n/literal.
        const modulo = crearModulo(
            [{id: "saludo", origen: "interno", tipo: "literal", values: {valor: {es: {type: "singular", value: "x"}}}}],
            {id: "literal"},
        );

        const problemas = modulo.validar();

        assert.ok(problemas.some(p => p.includes("PascalCase") && p.includes(`"Literal"`)), problemas.join("\n"));
    });

    it("dos entradas que comparten pascalCase generarían el mismo tipo, y una la validación lo ve venir", () => {
        // pascalCase("estado_actual") y pascalCase("estadoActual") dan las dos "EstadoActual": antes de
        // este cambio, las dos importaban su propio "EstadoActualParams" y compilar daba TS2300; hoy el
        // `Set` de imports de generateLangIndex() las dedupica en silencio, así que sin esta regla nadie
        // se entera de que una de las dos entradas está usando los params de la otra.
        const modulo = crearModulo([
            {id: "estado_actual", origen: "interno", tipo: "map", params: ["n"], values: {valor: {es: {valores: {a: {type: "singular", value: "x"}}}}}},
            {id: "estadoActual", origen: "interno", tipo: "literal", params: ["m"], values: {valor: {es: {type: "singular", value: "y"}}}},
        ]);

        const problemas = modulo.validar();

        assert.ok(problemas.some(p => p.includes("estado_actual") && p.includes("estadoActual")), problemas.join("\n"));
    });

    it("mismo pascalCase pero tipos distintos (XKeys y XParams) no es un choque", () => {
        // Un `map` sin params solo genera "FooBarKeys" y un literal con params solo "FooBarParams": no
        // chocan, y compilaban antes y compilan ahora. Rechazarlos sería bloquear datos correctos.
        const modulo = crearModulo([
            {id: "foo_bar", origen: "interno", tipo: "map", values: {valor: {es: {valores: {a: {type: "singular", value: "x"}}}}}},
            {id: "fooBar", origen: "interno", tipo: "literal", params: ["m"], values: {valor: {es: {type: "singular", value: "{{m}}"}}}},
        ]);

        const problemas = modulo.validar();

        assert.deepEqual(problemas, []);
    });

    it("dos entradas con pascalCase distinto no generan ningún problema de esta familia", () => {
        const modulo = crearModulo(TRADUCCIONES);

        const problemas = modulo.validar();

        assert.deepEqual(problemas, []);
    });
});
