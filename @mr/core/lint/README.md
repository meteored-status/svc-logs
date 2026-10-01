# `@mr/core-lint`

El linter de las convenciones del monorepo: un plugin de ESLint con las reglas que ninguna herramienta
estándar sabe expresar, y la configuración que se aplica a todo el código.

**Código fuente:** ver [`CODEMAP.md`](./CODEMAP.md).

```bash
yarn lint          # revisa todo el monorepo
yarn lint:fix      # y aplica lo que tenga arreglo automático
```

---

## Por qué existe

Hasta el 2026-09-23 este monorepo no tenía linter de ningún tipo, así que ninguna de las convenciones
de [`.github/copilot-instructions.md`](../dev/.github/copilot-instructions.md) la comprobaba una
herramienta: todas dependían de que alguien se diera cuenta en la revisión.

Meter un linter estándar no lo arreglaba. Las reglas que traen eslint o biome son las que menos duelen
si se saltan, y las que de verdad ahorran revisión —dónde va la documentación de un tipo, cómo se
agrupan los imports, dónde se inicializa una propiedad— no las expresa ninguna. Eso cambió al aparecer
un plugin propio que ya las tenía escritas: `eslint-plugin-mrpack`, del repositorio `homeconomy`. Este
paquete es ese plugin traído aquí, con los cambios que pide un framework que usan varios monorepos.

Vive en `@mr/core/*` porque la configuración tiene que llegar a todos los monorepos que consumen el
framework, y `@mr/core-*` es lo que tienen todos.

---

## Cómo llega a un monorepo

No hay que instalar nada a mano. `mrpack init` (y por tanto `mrpack update`):

1. añade `@mr/core/lint` si falta, como `@mr/core/dev` o `@mr/core/network`;
2. fija las `devDependencies` de la raíz a `eslint` y `@mr/core-lint`, con la versión de `eslint` que
   declara este `package.json`;
3. escribe los scripts `lint` y `lint:fix`, y un `eslint.config.mjs` de una línea que reexporta
   `@mr/core-lint/config`.

Lo hace `checkLint()`, en `@mr/cli/src/clases/init/lint.ts`. **Para subir de versión `eslint` o
`typescript-eslint` se toca este `package.json` y nada más**: el siguiente `init` lo propaga a la raíz.

---

## Las reglas

Nueve propias, bajo el prefijo `mrpack/`, más una selección de las estándar de ESLint y
`typescript-eslint`. La documentación de cada regla está en su propio fichero de `rules/`, y la de cada
decisión de configuración, en `config.js`.

| Regla | Qué comprueba | Autofix |
|---|---|---|
| `mrpack/import-blocks` | Tres bloques de imports (npm, otros workspaces, relativos) separados por una línea en blanco; destructurados antes que los default | Solo las líneas en blanco |
| `mrpack/class-section-comments` | `/* STATIC */` e `/* INSTANCE */` en las clases con estáticos; sin `/* STATIC */` en las que no los tienen | Sí |
| `mrpack/class-property-init-in-constructor` | Las propiedades de instancia se inicializan en el constructor | No |
| `mrpack/single-line-signature` | Los parámetros de una firma en una sola línea | No |
| `mrpack/config-object-params` | Con dos o más parámetros opcionales, al objeto de configuración; uno solo al final se queda posicional | No |
| `mrpack/jsdoc-type-members` | Los miembros de interfaces y enums se documentan en el bloque del tipo | No |
| `mrpack/no-returns-on-void` | Sin `@returns` en funciones `void` o `Promise<void>` | Sí |
| `mrpack/no-cross-workspace-relative-import` | Otro workspace se importa por nombre de paquete, no por ruta relativa | No |
| `mrpack/single-author-header` | Una sola cabecera de autoría, la del principio del fichero; las demás (también las comentadas con `//`) sobran | Sí |

### Lo que cambia respecto a `homeconomy`

- **`import-blocks` deduce la lista de workspaces** del `package.json` raíz (`lib/workspaces.js`). Allí
  era una constante con cuatro nombres, y su propio comentario decía que era la línea a sacar si el
  plugin se compartía: aquí cada monorepo consumidor tiene los suyos.
- **`config-object-params` deja pasar un único opcional al final**, tenga la forma que tenga
  (`buscar(id, transaction?)`, `render(params = {})`): solo salta con dos o más. Y admite
  `permitirUltimo`, nombres que al final no cuentan como el que sobra aunque haya otros opcionales
  delante; está `transaction`.
- **La configuración `casa` no está en el plugin sino en `config.js`**: es la del monorepo, no la de las
  reglas.
- **`single-author-header` es nueva**: allí no hay envío de framework, así que no hay cabeceras. Aquí
  `mrpack framework --send` solo quita la que está al principio del fichero (`stripAutoria()`), y
  cualquier otra se quedaba para siempre.
- **Las pruebas corren con `node:test`** y no con vitest, que aquí no entra: con `enableHardenedMode` y
  `npmMinimalAgeGate`, cada runner nuevo es una decisión de cadena de suministro.
- **`import-blocks` no cuenta la separación cuando hay código entre dos imports**, como el
  `sourceMapSupport.install();` de los `main.ts`: esas líneas en blanco no separan dos imports.
- **`no-var` se sustituye por un selector**: `no-var` denuncia también `declare var X: T;`, que es la
  única forma de declarar un global, y en este código eran todos los `var` que había.

---

## Niveles: por qué unas en `error` y otras en `warn`

Se midieron todas las reglas contra el código antes de encenderlas (2026-09-23, 1.303 ficheros `.ts`):
dieron 1.591 incumplimientos las ocho propias y otros tantos las estándar. Con esos números:

- **`error`** es lo que ya se cumplía, lo que tenía autofix (se aplicó: 507 ficheros) o lo que eran
  pocos casos a mano (se corrigieron). `yarn lint` sale sin errores.
- **`warn`** es lo que tiene cientos de casos sin autofix —`config-object-params` (155 desde que admite un
  único opcional al final y no se revisan las pruebas; 114 en firmas públicas de framework que llaman los monorepos consumidores), `single-line-signature` (16; eran 253 con el falso positivo de las flechas pasadas como argumento, ya arreglado) y
  `member-ordering` (410)— y las tres reglas que no salen de la convención escrita sino de
  `homeconomy`: `eqeqeq`, `no-unused-vars` y `prefer-const`.

Un `warn` no es una regla rebajada para siempre: se sube a `error` cuando esa regla esté limpia.

### Excepciones que no son deuda

- **`no-console`** no se aplica a las herramientas de línea de comandos (`@mr/cli`, `@mr/core-cli`,
  `mrlang` en `@mr/core/i18n/src/`) ni al propio logger (`utiles/log.ts`, `browser/log.ts`): escribir por
  consola es su trabajo.
- **Las pruebas no se revisan** (`spec/` y `*.spec.ts`): los helpers con opcionales y los imports
  relativos entre workspaces que necesita el arnés —compila con `rootDir` en la raíz, ver
  `services/status-frontend/spec/CODEMAP.md`— son la forma natural de escribir un caso.

---

## Añadir una regla

1. `rules/<nombre>.js`, con el docblock diciendo qué frase de la convención hace cumplir.
2. `spec/rules/<nombre>.spec.js` con `probador.run(...)`. **Rómpela a propósito** y comprueba que la
   prueba falla antes de darla por buena.
3. Regístrala en `index.js` (en `rules` y en las dos configuraciones) y dale nivel en `config.js`.
   `spec/index.spec.js` falla si se queda fuera de alguna.
4. Mídela contra el código (`yarn lint`) antes de elegir el nivel.

```bash
yarn workspace @mr/core-lint test
```
