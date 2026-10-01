# CODEMAP — `@mr/core-lint`

Mapa técnico del workspace `@mr/core/lint/`. JavaScript plano (`type: module`), sin compilar: ESLint
carga los ficheros tal cual.

## Árbol de módulos

```text
@mr/core/lint/
├─ index.js                      — el plugin: registro de las nueve reglas y las configs `recomendada`/`estricta`
├─ config.js                     — la configuración del monorepo (`@mr/core-lint/config`): ignorados, niveles, excepciones
├─ lib/
│  ├─ utilidades.js              — helpers de SourceCode compartidos (JSDoc de un nodo, rangos de línea, anclas)
│  ├─ workspaces.js              — raizDelMonorepo() y workspacesDe(): la lista de workspaces, cacheada por raíz
│  └─ probador.js                — RuleTester con el parser de TypeScript, montado sobre node:test
├─ rules/                        — una regla por fichero, cada una con su docblock
│  ├─ import-blocks.js
│  ├─ class-section-comments.js
│  ├─ class-property-init-in-constructor.js
│  ├─ single-line-signature.js
│  ├─ config-object-params.js
│  ├─ jsdoc-type-members.js
│  ├─ no-returns-on-void.js
│  ├─ no-cross-workspace-relative-import.js
│  └─ single-author-header.js      — una sola cabecera de autoría de `--send`, la del principio
├─ spec/
│  ├─ rules/*.spec.js            — un RuleTester por regla (valid/invalid/output)
│  ├─ workspaces.spec.js         — el helper contra un monorepo de mentira en un temporal, y la deducción en import-blocks
│  └─ index.spec.js              — que ninguna regla se quede fuera de ninguna configuración
├─ package.json                  — @mr/core-lint; exports `.` y `./config`; script `test`
├─ README.md
├─ CODEMAP.md
└─ CHANGELOG.md
```

## Superficie pública

| Entrada | Qué expone |
|---|---|
| `@mr/core-lint` | El plugin (`default`): `rules` y `configs.recomendada`/`configs.estricta` |
| `@mr/core-lint/config` | El array de configuración plana del monorepo. Lo reexporta el `eslint.config.mjs` raíz |

## Dependencias

- `typescript-eslint` y `typescript`, en `dependencies`: los importa `config.js` (parser y reglas
  `@typescript-eslint/*`), y `typescript` es peer de `typescript-eslint`.
- `eslint`, en `peerDependencies` y `devDependencies`. Peer porque lo pone la raíz, que es quien lo
  ejecuta; dev para las pruebas del propio paquete. **La versión de `devDependencies` es la que
  `mrpack init` copia a la raíz** (`@mr/cli/src/clases/init/lint.ts`).

## Flujo

1. `yarn lint` en la raíz → ESLint encuentra `eslint.config.mjs` → importa `@mr/core-lint/config`.
2. `config.js` registra el plugin y `typescript-eslint` él mismo; no depende de que el consumidor los
   haya extendido.
3. Para cada fichero, `import-blocks` pide a `lib/workspaces.js` los workspaces de su monorepo: sube
   hasta el `package.json` con `workspaces`, expande los patrones (literal o `carpeta/*`) y lee los
   `name`. Una vez por raíz y pasada.

## Pruebas

`yarn workspace @mr/core-lint test` → `node --test "spec/**/*.spec.js"`, sin compilar. `RuleTester`
usa los `describe`/`it` que se le asignan por estáticos en `lib/probador.js`.

Rutas: las pruebas que necesitan un fichero real (`no-cross-workspace-relative-import`) calculan la raíz
del paquete desde su propia ubicación. Si se mueven de directorio, hay que ajustar ese cálculo: al
pasarlas de `rules/` a `spec/rules/` pasó, y la prueba **siguió pasando en válido** mientras fallaba el
caso inválido, que es lo que lo destapó.
