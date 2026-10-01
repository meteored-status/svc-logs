import tseslint from "typescript-eslint";

import plugin from "./index.js";

/**
 * Directorios que no se revisan nunca. Son los mismos que la convención prohíbe leer en una
 * búsqueda de código —salida de compilación, datos, temporales— más los generados por las
 * herramientas. Van con `**` delante porque aparecen dentro de cada workspace, no solo en la raíz.
 */
const IGNORADOS = [
    "**/node_modules/**",
    "**/.yarn/**",
    "**/.next/**",
    "**/output/**",
    "**/files/**",
    "**/bin/min/**",
    "**/tmp/**",
    "**/next-env.d.ts",
    // Los genera Yarn en cada `install`.
    ".pnp.*",
    // Las pruebas no se revisan: los helpers con opcionales, los imports relativos entre workspaces que
    // necesita el arnés (compila con `rootDir` en la raíz, ver `services/status-frontend/spec/CODEMAP.md`)
    // y los fragmentos a medio escribir a propósito son la forma natural de escribir un caso, y
    // exigirles la convención del código de producción solo añade ruido.
    "**/spec/**",
    "**/*.spec.ts",
    "**/*.spec.tsx",
    // Los genera `mrlang` en cada `init` y no se versionan (`.gitignore`: `i18n/**/*.ts`).
    "i18n/**",
    // Las reglas son solo para TypeScript, pero ESLint abre los `.js` igualmente, y en un consumidor un
    // `.js` con JSX o sintaxis que su parser no entiende es un error fatal que no revisa nada. Buena
    // parte de los que hay además los genera `mrpack init` (`app.js`, `devel.js`).
    "**/*.js",
    "**/*.mjs",
    "**/*.cjs",
    "**/*.jsx",
];

/**
 * Configuración de ESLint del monorepo. La importa el `eslint.config.mjs` de la raíz, que escribe
 * `mrpack init`, y por eso está aquí y no en ese fichero: así llega a todos los monorepos que
 * consumen el framework con el siguiente `update`, igual que el resto de `@mr/core-*`.
 *
 * Los niveles salen de medir las reglas contra el código antes de encenderlas (2026-09-23, ver el
 * `README.md`), no de un criterio general:
 *
 * - `error` — lo que o ya se cumple, o se arregla con el autofix, o son pocos casos a mano.
 * - `warn` — lo que tiene cientos de casos sin autofix (`config-object-params`,
 *   `single-line-signature`, `member-ordering`) y las tres reglas que no salen de la convención
 *   escrita sino de `homeconomy` (`eqeqeq`, `no-unused-vars`, `prefer-const`). Se suben a `error`
 *   cuando estén limpias; hasta entonces se ven en el editor y en `yarn lint` sin romper nada.
 *
 * Registra `typescript-eslint` él mismo en vez de dar por hecho que el consumidor lo ha extendido,
 * que es lo que hacía `casa` en `homeconomy`: aquí no hay otro `eslint.config.mjs` que lo haga.
 */
export default [
    {
        ignores: IGNORADOS,
    },
    {
        files: ["**/*.ts", "**/*.tsx", "**/*.mts", "**/*.cts"],
        languageOptions: {
            parser: tseslint.parser,
            ecmaVersion: 2024,
            sourceType: "module",
        },
        plugins: {
            "mrpack": plugin,
            "@typescript-eslint": tseslint.plugin,
        },
        rules: {
            ...plugin.configs.recomendada.rules,
            // Un único opcional al final no se denuncia; con dos o más, `transaction?: Transaction` al
            // final (el idiom del acceso a datos) no cuenta como el que sobra. En `warn`: 155 casos sin
            // autofix, 114 en firmas públicas de framework que llaman los monorepos consumidores.
            "mrpack/config-object-params": ["warn", {permitirUltimo: ["transaction"]}],
            // 16 casos, sin autofix: firmas partidas de verdad, casi todas constructores. Eran 253 hasta que
            // se arregló el falso positivo de las flechas sin paréntesis pasadas como argumento.
            "mrpack/single-line-signature": "warn",

            /* Lo que pide `.github/copilot-instructions.md` y ya sabe expresar una regla estándar. */

            // «Llaves en if/else/for/while: siempre, aunque el cuerpo sea de una sola línea.»
            curly: ["error", "all"],
            // «No debe haber dos líneas en blanco consecutivas en ningún fichero .ts ni .js.»
            "no-multiple-empty-lines": ["error", {max: 1, maxBOF: 0, maxEOF: 1}],
            // «Sin `any` explícito salvo casos justificados»: aviso, no error, para que los casos
            // justificados no obliguen a un `eslint-disable` en cada uno.
            "@typescript-eslint/no-explicit-any": "warn",
            // «Sintaxis de tipos array: usar siempre `Tipo[]`, nunca `Array<Tipo>`.»
            "@typescript-eslint/array-type": ["error", {default: "array"}],
            // «Usar siempre la keyword `type` cuando el import sea exclusivamente de un tipo.» Con
            // `separate-type-imports` porque es la forma que ya domina: `import type {…}` sale 1.253
            // veces, y el `type` en línea 311.
            "@typescript-eslint/consistent-type-imports": ["error", {
                prefer: "type-imports",
                fixStyle: "separate-type-imports",
            }],
            // `camelCase` para variables, parámetros y funciones; `PascalCase` para clases, interfaces,
            // tipos y enums. Los componentes de React son funciones en `PascalCase`, así que las
            // funciones admiten las dos formas. Las propiedades de objeto quedan fuera: a menudo son
            // claves de datos externos (cabeceras HTTP, columnas de una tabla, variables de entorno).
            "@typescript-eslint/naming-convention": ["error",
                {selector: "variableLike", format: ["camelCase", "PascalCase", "UPPER_CASE"], leadingUnderscore: "allow"},
                {selector: "typeLike", format: ["PascalCase"]},
                {selector: "function", format: ["camelCase", "PascalCase"]},
            ],
            // «Dentro de cada bloque, las propiedades y getters/setters van antes del constructor, y los
            // métodos después.» Los comentarios de sección los pone el plugin; el orden, esta regla.
            // En `warn`: 410 casos sin autofix, casi todos getters declarados tras el constructor.
            "@typescript-eslint/member-ordering": ["warn", {
                default: [
                    "static-field", "static-get", "static-set", "static-method",
                    "instance-field", "instance-get", "instance-set",
                    "constructor",
                    "instance-method",
                ],
            }],
            // «Logging: usar `info`/`error` de `services-comun/modules/utiles/log`.»
            "no-console": ["error", {allow: ["debug", "warn", "error"]}],
            // `no-var` no sirve aquí: denuncia también `declare var PRODUCCION: boolean;`, que es la única
            // forma de declarar un global en TypeScript, y en este código son **todos** los `var` que hay
            // (11 de 11). Se prohíbe el `var` de verdad y se deja pasar el ambiental, que es el que lleva
            // `declare` o el que está dentro de un `declare global {…}` / `declare namespace`.
            "no-restricted-syntax": ["error", {
                selector: "VariableDeclaration[kind='var'][declare!=true]:not(TSModuleDeclaration[declare=true] VariableDeclaration)",
                message: "Usa `let` o `const`: `var` solo vale en una declaración ambiental (`declare var`).",
            }],

            /* No salen de la convención escrita sino de `homeconomy`. En `warn` por decisión, no por deuda. */

            eqeqeq: ["warn", "always", {null: "ignore"}],
            "prefer-const": "warn",
            "@typescript-eslint/no-unused-vars": ["warn", {
                argsIgnorePattern: "^_",
                varsIgnorePattern: "^_",
                caughtErrors: "none",
            }],
        },
    },
    {
        // Las herramientas de línea de comandos escriben en la consola porque es su salida, y el
        // logger escribe en ella porque es su trabajo.
        files: [
            "@mr/cli/**",
            "@mr/core/cli/**",
            "@mr/core/i18n/src/**",
            // Una demo suelta que imprime al importarse; no es API (ver su CODEMAP).
            "@mr/core/i18n/modules/example.ts",
            "framework/services-comun/modules/utiles/log.ts",
            "framework/services-comun/modules/browser/log.ts",
        ],
        rules: {
            "no-console": "off",
        },
    },
];
