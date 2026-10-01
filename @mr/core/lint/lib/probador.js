import {describe, it} from "node:test";

import {RuleTester} from "eslint";
import tseslint from "typescript-eslint";

/**
 * El `RuleTester` corre sobre `node:test` y no sobre vitest, que en este monorepo no entra
 * (`enableHardenedMode` y `npmMinimalAgeGate` hacen de cada runner nuevo una decisión de cadena de
 * suministro). `RuleTester` no depende de ningún runner concreto: usa los `describe`/`it` que se le
 * den por estáticos, y si no se le da ninguno busca los globales, que es lo que hacía con vitest.
 */
RuleTester.describe = describe;
RuleTester.it = it;

/**
 * `RuleTester` ya configurado con el parser de TypeScript, que es el único con el que estas reglas
 * tienen sentido: todas se apoyan en nodos que solo existen en el AST de typescript-eslint
 * (`TSInterfaceDeclaration`, `PropertyDefinition` con modificadores, anotaciones de tipo…).
 *
 * Sin `project`: ninguna regla necesita información de tipos, solo la sintaxis, y pedir un
 * `tsconfig` obligaría a mantener uno de mentira para los fragmentos de los tests.
 */
export const probador = new RuleTester({
    languageOptions: {
        parser: tseslint.parser,
        ecmaVersion: 2024,
        sourceType: "module",
    },
});
