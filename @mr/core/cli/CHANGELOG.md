# [Changelog](https://keepachangelog.com/en/1.1.0/) — `@mr/core-cli`

---

## 2026.9.4 20:10 — [Jose]

### Added

- **`@mr/core-cli/esbuild`**, la compilación de las dos CLI. Los dos `src/esbuild.config.mjs` eran
  el mismo fichero con distinto entry; ahora son de diez líneas —`@mr/cli` tiene además el
  enganche que arranca el watch de `mrlang`, que le pasa por `alWatch`—.

  De la `url` que recibe sale todo lo que es de cada CLI: su directorio, su `package.json` para los
  externals, su `tsconfig` y la resolución de `typescript`.

- `esbuild` entra como devDependency. **Es la única excepción a la regla de mantener este paquete
  sin dependencias**, y va razonada: su oficio es sostener las dos CLI, y compilarlas es parte de
  eso. `typescript` no entra: se resuelve desde el paquete que llama, que ya lo declara.

Comprobado que el refactor no cambia nada: los dos bundles salen **byte a byte idénticos**. Y las
cuatro rutas siguen funcionando — compilación normal, watch con el hijo de `mrlang`, cierre con
Ctrl+C sin huérfanos y arranque en frío sin `bin/min/`.

---

## 2026.9.4 19:00 — [Jose]

### Added

- **`@mr/core-cli/arranque`**, el arranque de las dos CLI, que estaba duplicado —una copia en el
  `bin/` de cada una— desde que se separaron. Ejecuta el bundle y, si no está, lo compila y
  reintenta.

  Es el único fichero del paquete en **JavaScript plano**, y tiene que serlo: lo carga el `bin` de
  cada CLI antes de que exista nada compilado. No estorba, porque el `tsconfig` no lleva `allowJs`
  y el fichero no entra en la compilación — comprobado con `tsc --listFiles`.

  Recibe el `__dirname` de quien llama, que no es opcional: aquí dentro `__dirname` es el de
  `@mr/core-cli`.

Comprobado que arranca por las cuatro vías —`yarn mrpack`, `yarn mrlang`, el script del workspace y
desde otro cwd— y que en frío, sin `bin/min/`, los dos se compilan solos y siguen adelante.

> Este arranque **no se puede quitar**, que era la duda que lo trajo aquí. Compilar cuando falta el
> bundle es el único camino posible en un clon limpio: `mrpack` no puede compilarse a sí mismo
> antes de existir. Y la supresión de `DEP0040` sigue haciendo falta en `mrpack` —comprobado
> quitándola: emite el aviso por la cadena `dd-trace` → `node-fetch@2` → `punycode`—, aunque en
> `mrlang` ya no.

---

## 2026.9.4 11:40 — [Jose]

### Added

- **Paquete nuevo.** Nace al separar las dos herramientas de línea de comandos del monorepo:
  `mrlang` se muda de `@mr/cli` a `@mr/core-i18n`, y estos cinco ficheros —461 líneas— son lo que
  las dos usaban en común mientras compartieron workspace.

  Se sacan aquí en vez de duplicarlos o de hacer que una CLI dependa de la otra, que eran las otras
  dos salidas. El resultado es el que se buscaba: **`@mr/cli` y `@mr/core-i18n` no se conocen**.

  | Ruta | Viene de |
  |------|----------|
  | `@mr/core-cli/fs` | `@mr/cli/src/utiles/fs.ts` |
  | `@mr/core-cli/log` | `@mr/cli/src/utiles/log.ts` |
  | `@mr/core-cli/colors` | `@mr/cli/src/mrpack/clases/colors.ts` |
  | `@mr/core-cli/colors/base` | `@mr/cli/src/mrpack/utiles/colors.ts` |
  | `@mr/core-cli/modulo` | `@mr/cli/src/mrpack/modulo.ts` |

  El contenido de los cinco es el que había, sin tocar: solo cambian sus imports entre ellos y las
  cabeceras que decían «que usa el código propio de `@mr/cli`», que ahora nombran a las dos CLI.

- Las rutas salen del mapa `exports`, con la clave sin extensión y el destino con ella, igual que
  en `@mr/core-utils`, `@mr/core-dev` y `@mr/core-i18n`.

### Sin dependencias

- **Ni `services-comun` ni `@mr/core-dev`.** Solo `tslib`. Es la base de las dos CLI, y una base
  que arrastra medio monorepo detrás no es una base. Lo que ataba al paquete eran cuatro cosas
  pequeñas, y las cuatro son ya locales y privadas —no cambia la superficie pública—:

  | Venía de | Qué era | Dónde está |
  |----------|---------|------------|
  | `services-comun/…/hash` | `md5()` | `modules/fs.ts`, una línea sobre `node:crypto` |
  | `services-comun/…/random` | `random()` | `modules/fs.ts`, ocho líneas |
  | `services-comun/…/promise` | `PromiseDelayed()` | `modules/modulo.ts`, cuatro líneas |
  | `@mr/core-dev` | el `tsconfig` base | inlineado en `tsconfig.json` |

- El `tsconfig` deja de extender el de `@mr/core-dev` y lleva escritas las opciones que aquella
  cadena resolvía, **menos los tipos globales del bundler** (`PRODUCCION`, `ENTORNO`, `NEXTJS`, …),
  que este código no usa — comprobado antes de quitarlos. Queda comentado en el propio fichero que
  el precio es no enterarse si el tsconfig base cambia, y que el contrapeso es que estos cinco
  ficheros se compilan también dentro de las dos CLI, que sí lo extienden.

### Fixed

- **`random()` devolvía a veces menos caracteres de los pedidos.** El original de `services-comun`
  hace `Math.round(Math.random()*62)` sobre un alfabeto de 62 caracteres: el índice 62 se sale y
  `charAt` devuelve `""`. Medido sobre 20.000 tiradas, **1.285 cadenas salían más cortas de 8**, y
  por el redondeo el primer y el último carácter aparecían la mitad de veces que el resto. La copia
  local usa `Math.floor`: 0 de 20.000.

  Aquí se usa para el nombre del fichero temporal de `safeWrite()`, así que el efecto real era
  menos entropía en ese nombre —no un fallo visible—. **El original no se toca**: esta es una copia
  y el cambio va documentado en su sitio, pero `services-comun/modules/utiles/random` sigue igual y
  con el mismo comportamiento para todos sus consumidores.

  `md5()` sí es idéntica, y ahí importa que lo sea: de ella salen los hashes con los que
  `mrpack framework` decide si un paquete ha cambiado.

### Notas de la extracción

- **Los 97 imports se reescribieron resolviendo cada ruta relativa, no por texto.** Los mismos
  cinco módulos se referenciaban con profundidades distintas (`../../utiles/fs`,
  `../../../utiles/fs`, `../../../../utiles/fs`…) según dónde estuviera el fichero, y un
  buscar/reemplazar habría dejado fuera la mitad.
- El conjunto se eligió por **cierre transitivo**, no a ojo: partiendo de los cuatro módulos que
  `mrlang` importaba de fuera de su carpeta salió un quinto, `mrpack/utiles/colors.ts`, del que
  cuelga el `colors` cíclico.
- Comprobado que el código acaba **dentro** de los bundles y no como un `require` externo:
  `mrpack-run.js` no contiene ni una referencia a `@mr/core-cli` y sí las marcas de los ficheros
  (`FgMagenta`, `parseArgs`).
