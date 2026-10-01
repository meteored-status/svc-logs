# [Changelog](https://keepachangelog.com/en/1.1.0/) — `@mr/core-lint`

---

## 2026.9.23 11:39 — [Jose]

### Fixed

- **`single-line-signature` marcaba como firma partida cada callback pasado a un `map`, `forEach` o
  `then`** cuando era una flecha sin paréntesis (`docs.map(doc => {…})`): tomaba el `(` y el `)` de la
  llamada como si fueran los de la lista de parámetros. Ahora el paréntesis tiene que ser de la propia
  función. Los avisos bajan de 253 a 16, que son las firmas partidas de verdad.

### Changed

- **`config-object-params` deja pasar un único parámetro opcional, o con valor por defecto, si es el
  último**, tenga la forma que tenga: `buscar(id, transaction?)` o `render(params = {})`. Un objeto de
  configuración con una sola propiedad no ordena nada, y era el caso más común. Solo salta con dos o más
  opcionales, que es cuando hay que pasar `undefined` para llegar al siguiente. `permitirUltimo` sigue,
  para que con varios opcionales `transaction` no cuente como el que sobra.
- **Las pruebas ya no se revisan**: `spec/`, `*.spec.ts` y `*.spec.tsx` pasan a los ignorados, y sobran
  las dos excepciones por regla que había para ellas (`no-cross-workspace-relative-import` en `spec/`, y
  la de `config-object-params`). Con los dos cambios, los avisos de `config-object-params` bajan de 458
  a 155.

## 2026.9.23 09:01 — [Jose]

### Added

- **El paquete, con las ocho reglas de `eslint-plugin-mrpack`** traídas de `homeconomy`:
  `import-blocks`, `class-section-comments`, `class-property-init-in-constructor`,
  `single-line-signature`, `config-object-params`, `jsdoc-type-members`, `no-returns-on-void` y
  `no-cross-workspace-relative-import`, con sus pruebas pasadas de vitest a `node:test`.
- **`@mr/core-lint/config`**, la configuración del monorepo: las ocho reglas más las estándar que
  escriben el resto de la convención, con niveles elegidos midiendo contra el código. Ver el README.
- **`lib/workspaces.js`**: `import-blocks` deduce los workspaces del `package.json` raíz si no se le
  pasan. Allí eran una constante; aquí cada monorepo tiene los suyos.
- **`permitirUltimo` en `config-object-params`**, para `transaction?: Transaction` al final de la firma.

### Added

- **`mrpack/single-author-header`**, con autofix: deja una sola cabecera de autoría, la del principio
  del fichero, y borra las demás —también las comentadas con `//`, como la de un fichero comentado
  entero—. `mrpack framework --send` solo quita la cabecera que está al principio, así que cualquier
  otra se quedaba para siempre y con datos falsos.

### Fixed

Encontrado en la revisión, antes del primer envío:

- **`class-section-comments` insertaba el marcador en mitad de la línea anterior** cuando esta acababa
  en un comentario (`= 64 * 1024; // 64 KB`): `getCommentsBefore()` cuenta ese comentario como del
  miembro siguiente. Lo arregla `comentariosPropios()` en `lib/utilidades.js`, que usa también
  `import-blocks`, donde el mismo fallo daba un falso «falta separación» entre dos imports del mismo
  bloque.
- **`class-section-comments` trataba `static {…}` como miembro de instancia**: un `StaticBlock` no lleva
  `static: true`.
- **`import-blocks` metía los alias de ruta (`@/…`, `~/…`) en el bloque de dependencias públicas**.
  Son del propio workspace.
- **ESLint ya no abre los `.js`/`.mjs`/`.cjs`/`.jsx`**: las reglas son solo para TypeScript, y en un
  consumidor un `.js` que su parser no entiende daba un error fatal.

### Changed

- **`import-blocks` no cuenta las líneas en blanco cuando hay código entre dos imports** (el
  `sourceMapSupport.install();` de los `main.ts`). Contarlas obligaba a pegar el código al import siguiente
  para cuadrar la cuenta, que es justo lo que llegó a hacerse. En `homeconomy` ese caso avisaba sin
  arreglar para no borrar un `"use client"` mal colocado; aquí no avisa ni arregla.
- **`no-var` sustituida por un selector** que deja pasar `declare var` y los `var` de un
  `declare global {…}`: son la única forma de declarar un global, y eran los 11 `var` del código.
