# [Changelog](https://keepachangelog.com/en/1.1.0/)

---

## 2026.7.17

### Added — `src/mrpack/clases/init/ignore.ts`

- [Jose] **`mrpack init` añade `.codex/` al `.gitignore` generado**: la plantilla `IGNORE`
  incluye ahora la entrada `.codex/`, de modo que el directorio de configuración local de
  Codex quede ignorado automáticamente al ejecutar `mrpack init` en cualquier monorepo,
  sin necesidad de añadirlo a mano al `.gitignore`.

### Added — `src/mrpack/clases/init/symlinks.ts`, `src/mrpack/clases/init.ts`

- [Jose] **`mrpack init` crea/corrige el enlace `CLAUDE.md` → `@mr/core/dev/CLAUDE.md`**:
  Claude Code no lee `AGENTS.md` automáticamente (solo `CLAUDE.md`/`CLAUDE.local.md`), así
  que se añade una nueva `initClaude()`, análoga a `initAgents()`, que gestiona ese symlink.
  El fichero canónico `@mr/core/dev/CLAUDE.md` contiene dos imports (`@AGENTS.md` y
  `@.github/copilot-instructions.md`), la sintaxis nativa de Claude Code para incluir
  contenido de otro fichero, evitando duplicar las instrucciones ya mantenidas en
  `AGENTS.md`/`.github/copilot-instructions.md`. Nótese que la mención a
  `.github/copilot-instructions.md` dentro del propio `AGENTS.md` es solo texto entre
  backticks (no un import), por lo que su contenido solo llega a Claude a través de este
  segundo import explícito en `CLAUDE.md`. Extraída además `initSymlinkFichero()` (helper
  compartido por `initAgents`/`initClaude`) para no triplicar la lógica de comprobar/recrear
  un symlink de fichero simple.

---

## 2026.7.13

### Added — `src/mrpack/clases/init/run.ts`, `src/mrpack/clases/init.ts`

- [Jose] **`mrpack init` genera acciones de depuración por workspace en `.run/`**: nueva
  función `initRun()` que crea, en la raíz del proyecto, un fichero
  `.run/{type}-{service}.run.xml` (acción `ejecutar => {type} => {service}` de JetBrains) por
  cada workspace cuyo `deploy.type` sea `service`/`cronjob`/`job` y que tenga `enabled: true`,
  `devel.enabled: true` y `build.framework: "meteored"`, permitiendo depurarlo
  individualmente (`yarn workspace {service} run devel`) sin configuración manual. Si `.run/`
  no existe se crea; si ya existe, se eliminan las acciones de workspaces que hayan dejado de
  cumplir esas condiciones (renombrados, deshabilitados, eliminados…) y se regeneran las
  vigentes, respetando cualquier otro `.run.xml` no gestionado por `mrpack`.

### Changed — `package.json`

- [Jose] `dd-trace` actualizado de `^5.113.0` a `^6.2.0`. Revisado el *changelog* oficial
  del major: los *breaking changes* de la v6 (Node.js ≥22 como mínimo soportado, retirada de
  APIs ya deprecadas de AppSec/plugins y cambios en Test Optimization) no afectan al uso
  actual (`tracer.init()`, `tracer.trace`, `formats` de `dd-trace/ext`, spans manuales en
  HTTP/WebSocket). Sin cambios de código necesarios.

### Fixed — `src/esbuild.config.mjs`

- **`tscBin` fallaba con `ERR_PACKAGE_PATH_NOT_EXPORTED` tras actualizar a TypeScript 7**:
  `require.resolve("typescript/bin/tsc")` dejó de funcionar porque TypeScript 7 ya no
  expone el subpath `./bin/tsc` en el campo `exports` de su `package.json` (aunque el
  fichero sigue existiendo físicamente). Ahora `tscBin` se resuelve componiendo la ruta a
  partir de `typescript/package.json` (`dirname(require.resolve("typescript/package.json"))`
  + `bin/tsc`), evitando depender de subpaths restringidos por `exports`.

### Changed — `package.json`, `README.md`

- **`typescript` revertido de `^7.0.2` a `^6.0.3`**: el compilador nativo de TypeScript 7
  (Go, "Corsa"/`tsgo`) todavía no soporta resolución de módulos bajo Yarn PnP (ver
  [microsoft/typescript-go#460](https://github.com/microsoft/typescript-go/issues/460),
  PR [#1966](https://github.com/microsoft/typescript-go/pull/1966) sin fusionar). Con TS7,
  `tsc --noEmit`/`--watch` no resolvía ningún módulo de workspace (`services-comun/...`,
  `@mr/core-*`, etc.), aunque esbuild sí compilaba correctamente. Documentada la limitación
  en `README.md` para no repetir el upgrade hasta que el soporte de PnP esté publicado en
  una versión estable de TS7.

### Changed — `src/mrpack/clases/**` (refactorización de `mrpack`)

- **Deduplicación y división de módulos grandes**: extraído `ejecutarTablaInteractiva()`
  compartido en `framework/gestor/index.ts`; extraído `ejecutarConLoginRetry<T>()` en
  `paquete/storage.ts`; tipado completo de `auto-doc.ts` (sin `any` explícitos, nuevo tipo
  `JSONValue`/`IEsquema*`); `init.ts` dividido en 8 submódulos bajo `clases/init/` (`git.ts`,
  `legacy.ts`, `scripts.ts`, `dependencias.ts`, `symlinks.ts`, `yarnrc.ts`,
  `config-workspaces.ts`); unificada la lógica duplicada de `getBundlerCoherente`/
  `getBundlerNormalizado` (`workspace/service.ts` e `init.ts`) en `clases/bundler.ts`;
  `workspace/service.ts` y `framework/gestor/tabla.ts` reducidos extrayendo funciones puras
  de formateo/parsing (`workspace/service-log-utils.ts`) y de cálculo/renderizado de diff
  (`framework/gestor/diff-render.ts`). De paso se corrigieron dos bugs reales: un bucle
  infinito potencial en `extractFileRefs` (faltaba avanzar `match` en una rama con
  `continue`) y una discrepancia entre las dos copias de `getBundlerCoherente` (una de ellas
  no comprobaba `reflect-metadata`).
- **Nuevo diseño de consola en `clases/log.ts`**: `Log.info`/`Log.error` escriben ahora
  directamente vía `process.stdout.write`/`process.stderr.write` en vez de
  `console.info`/`console.error`, evitando que `console.group()`/`console.groupEnd()`
  indentara sus líneas y las mezclara de forma confusa con el prefijo
  `[hora][tipo][etiqueta]` propio de `Log`. El anidamiento lógico de secciones (antes
  representado con indentación) se representa ahora dentro de la propia etiqueta mediante
  una pila interna (p.ej. `[init]` → `[init cliente]` → `[init cliente yarn]`, sin duplicar
  cuando la etiqueta coincide con la del grupo más interno). Nuevos métodos `Log.group(cfg,
  ...txt)`/`Log.groupEnd()` sustituyen al patrón previo `Log.info(...); console.group();
  ...; console.groupEnd();` en `init.ts` y submódulos, `yarn.ts` y `framework/cliente.ts`.
  Los corchetes `[ ]` del prefijo se colorean en morado para diferenciarlos del contenido.
- **Limpieza de imports**: eliminados imports sin usar (`IConfigServices` en `devel.ts`,
  `Manifest` en `workspace/service.ts`) y convertidos a `import type` los imports usados
  solo como tipo (`auto-doc.ts`, `workspace/compilar.ts`, `workspace/i18n.ts`,
  `workspace/service.ts`, `mrpack.ts`, `modulo.ts`).
- **Segunda pasada de limpieza de imports/`type` y parámetros no usados**: revisión completa
  de `mrpack/` con `tsc --noEmit --noUnusedLocals --noUnusedParameters --isolatedModules
  --verbatimModuleSyntax`. Eliminados imports sin usar en `manifest/workspace/legacy.ts`;
  convertidos a `import type`/especificador `type` los imports usados solo como tipo en
  `deployment/imagen/index.ts`, `deployment/lambda/index.ts` y `modulos/auto-doc.ts`;
  renombrados con prefijo `_` los parámetros no usados de `modulo.ts::parsePositionals` y
  `mrpack.ts::parseParams`; eliminado el campo muerto `consolaEscribiendo` de `Paquete`
  (se asignaba pero nunca se leía); eliminado un bloque de código comentado muerto en
  `workspace/i18n.ts`. `horaLocal`/`fechaHoraLocal`, duplicadas entre `clases/log.ts` y
  `workspace/service-log-utils.ts`, se extrajeron al nuevo `utiles/fecha.ts`.
- **División de `paquete/index.ts`** (1073 → 847 líneas), con el mismo criterio de extraer
  solo las partes puras/de bajo acoplamiento aplicado antes a `Service`/`GestorTabla`:
  nuevo `paquete/consola.ts` (clase `PaqueteConsola` + `ConsolaEstado`/`STATUS`/`IConsola`,
  encapsula el estado de renderizado de la consola de progreso, antes 7 campos sueltos en
  `Paquete`); nuevo `paquete/archivos-cambiados.ts` (`EstadoArchivo`/`OrigenArchivo`/
  `IArchivoCambiado` + la función pura `combinarArchivosCambiados()`, reexportados desde
  `paquete/index.ts` para no romper a `framework/gestor/tabla.ts`/`diff-render.ts`); y la
  función `capturarDatosPush()` movida desde un método privado de `Paquete` a
  `paquete/push-log.ts`. El resto de `Paquete` (`pull`/`push`/`reset`/`applyUpdate`) se deja
  intacto por su fuerte acoplamiento a estado mutable y E/S real.

---

## 2026.7.2+8

### Fixed — `src/mrpack/clases/manifest/workspace/build/index.ts`, `src/mrpack/clases/init.ts`

- **`build.bundler` podía derivar en `esbuild` para workspaces con `reflect-metadata`**:
  esbuild no emite `decoratorMetadata` (opción `emitDecoratorMetadata` de TypeScript), por
  lo que los decoradores que dependen de `reflect-metadata` en tiempo de ejecución (p. ej.
  DI basada en tipos) dejaban de funcionar en workspaces compilados con esbuild, aunque el
  `tsconfig.json` tuviera `emitDecoratorMetadata`/`experimentalDecorators` activados.
  - `ManifestWorkspaceBuildLoader.getBundler()` ahora recibe también las `dependencies` del
    `package.json` del workspace y fuerza `rspack` (que sí soporta `decoratorMetadata` vía
    `builtin:swc-loader`) cuando detecta `reflect-metadata`, tanto si el bundler se deriva
    automáticamente como si viene informado explícitamente como `esbuild` en `mrpack.json`.
  - Existía una segunda implementación independiente de esta misma lógica en `init.ts`
    (`getBundlerCoherente`/`getBundlerNormalizado`, usada por `checkScripts` en `yarn mrpack
    init`) que no conocía esta excepción y revertía el bundler a `esbuild` (y el script
    `packd` de `package.json` a `yarn g:esbuild`) en cada ejecución de `init`. Se ha
    aplicado la misma corrección ahí, propagando `paquete.dependencies` desde
    `loadConfig()`/`initWorkspace()`.

### Changed — `README.md`

- Documentada la excepción de `reflect-metadata` en la normalización de `build.bundler`.

---

## 2026.7.2+7

### Fixed — `src/mrpack/clases/init.ts`

- **Detección de puerto legacy de Next.js incompleta al migrar `scripts.dev`**: la
  expresión regular usada para preservar el puerto de invocaciones previas exigía
  literalmente `yarn run next dev -p <n>`, por lo que variantes igualmente válidas no se
  reconocían y el puerto se perdía (se aplicaba `8080` por defecto). Por ejemplo, con el
  script `"yarn run next dev -p 13797"` el problema no se reproducía, pero sí con formas
  habituales como `"next dev -p 13797"` (sin `yarn run` delante, ejecutando el binario
  directamente) o `"yarn run next dev --port 13797"` (usando `--port` en vez de `-p`).
  - La detección ahora usa `/next\s+dev\b.*?(?:-p|--port)[=\s]+(\d+)/`, que reconoce el
    puerto independientemente de si el script empieza por `yarn`, `yarn run` o nada,
    admite tanto `-p` como `--port` (con espacio o `=`), y tolera flags adicionales antes o
    después del puerto (p. ej. `--turbo`).

### Changed — `README.md`

- Actualizada la descripción de la preservación de puerto en `scripts.dev` para reflejar
  el nuevo patrón de detección, más permisivo con las variantes de invocación de `next dev`.

---

## 2026.7.2+6

### Changed — `src/mrpack/clases/workspace/service.ts`

- **`mrpack devel` ya no escribe en disco al detectar cambios en `mrpack.json`**: el
  watcher de workspace (`Service.updatePackageFile`) normalizaba `build.bundler` y
  reescribía `scripts` de `package.json` (vía `Service.applyScripts`/
  `updateWorkspaceScripts`) en **cada** evento de `change` sobre `mrpack.json` durante la
  ejecución de `devel`, no solo en la primera lectura. Esto provocaba escrituras
  recurrentes en `package.json` mientras el proceso estaba en marcha, además de duplicar
  (con matices) la normalización que ya hace `mrpack init`.
  - `updatePackageFile()` ahora usa `ManifestWorkspaceLoader.loadSync()` (lectura pura, sin
    persistencia) en lugar de `load()`, y ya no llama a `config.save()` ni reescribe
    `package.json`. Sigue detectando si el bundler coherente ha cambiado para reiniciar el
    compilador cuando corresponde, y actualiza `this.config` en memoria para reflejar el
    resto de cambios (p. ej. `enabled`), pero el fichero nunca se toca durante este ciclo.
  - Eliminados `Service.applyScripts` y `updateWorkspaceScripts` (código muerto tras el
    cambio anterior) y la interfaz `IPackageJsonWorkspace`, ya sin uso.
  - La normalización de `scripts` de `package.json` (incluida la migración de puerto de
    `g:nextjs`) sigue ocurriendo únicamente en la fase de primera lectura: `yarn mrpack init`
    (`checkScripts` en `init.ts`).

### Changed — `README.md`

- Documentado que el watcher de `mrpack devel` solo observa `mrpack.json` (lectura en
  memoria) y nunca escribe en él ni en `package.json`; esa normalización/escritura queda
  reservada a la fase de primera lectura (arranque del proceso y `mrpack init`).

---

## 2026.7.2+5

### Fixed — `src/mrpack/clases/manifest/index.ts`, `src/mrpack/clases/workspace/service.ts`

- **Reseteo destructivo de `mrpack.json` al editarlo a mano durante `mrpack devel`**: el
  watcher de workspace (`Service.initWatcher`) reacciona a cada evento de `change` sobre
  `mrpack.json` invocando `ManifestWorkspaceLoader.load()`. Si el fichero se guardaba en un
  estado transitorio con JSON sintácticamente inválido (habitual mientras se edita a mano),
  `ManifestLoader.load()` capturaba **cualquier** error de `readJSON` —incluido un
  `SyntaxError` de parseo— y lo trataba igual que un fichero inexistente: reseteaba el
  manifest a los valores por defecto y los persistía inmediatamente en disco, destruyendo
  toda la personalización del `mrpack.json` en curso de edición.
  - `ManifestLoader.load()` ahora distingue el código de error: solo si es `ENOENT`
    (fichero inexistente) se resetea a los valores por defecto y se guarda. Para cualquier
    otro error (JSON inválido) se **rechaza la promesa** sin tocar el manifest en memoria
    ni escribir el fichero.
  - `Service.updatePackageFile()` ya capturaba los errores del watcher (`initWatcher` hace
    `.catch(err => Log.error(...))` sobre `updatePackageFile()`), por lo que ahora, ante un
    `mrpack.json` temporalmente inválido, el error se registra en el log y el workspace
    conserva la configuración previa (`anterior`) sin sobrescribir nada; la siguiente
    escritura válida del fichero se recoge con normalidad en el próximo evento `change`.
  - Se añade `this.config.catch(() => undefined)` en el constructor de `Service` para evitar
    un aviso de `unhandledRejection` si `mrpack.json` ya es inválido al arrancar el proceso,
    sin alterar el rechazo real que reciben quienes hagan `await this.config`.

---

## 2026.7.2+4

### Fixed — `src/mrpack/clases/init.ts`, `src/mrpack/clases/workspace/service.ts`, `package.json`

- **Migración de `scripts.dev` para Next.js preservando puerto**: al normalizar workspaces
  `node+nextjs`, `mrpack init` y el watcher de `mrpack devel` detectan el puerto previo en
  `scripts.dev` tanto en formato `NEXTJS_PORT=<n>` como en formato legacy
  `yarn run next dev -p <n>`, y lo convierten a `NEXTJS_PORT=<n> yarn g:nextjs`.
  Si no hay puerto previo detectable, se usa `8080` por defecto.
- **`g:nextjs` ahora respeta `NEXTJS_PORT`** en el script raíz: ejecuta
  `cd "$INIT_CWD" && yarn run next dev -p ${NEXTJS_PORT:-8080}`, permitiendo fijar el puerto
  desde `scripts.dev`, shell o CI sin perder el fallback.

### Changed — `README.md`

- Documentada la nueva normalización de `scripts.dev` para Next.js, la preservación de puertos
  legacy y el fallback a `8080`.

---

## 2026.7.2+3

### Fixed — `src/mrpack/utiles/merge.ts`, `package.json` (sustitución de `diff3` por `node-diff3`)

- **`ReferenceError: ed is not defined` al fusionar ficheros con `applyUpdate`**: la librería
  `diff3@0.0.4` (`onp.js`, algoritmo O(NP)) asigna la variable `ed` sin declararla
  (`ed = delta + 2 * p;`), lo que funciona como global implícita en scripts sueltos pero lanza
  `ReferenceError` en el contexto estricto en el que se ejecuta el CLI compilado. El fallo
  ocurría dentro de `Object.compose` (`onp.js`) → `diff3MergeIndices`/`diff3Merge`
  (`diff3/diff3.js`) → `merge3` (`utiles/merge.ts`) → `PaqueteFile.mezclar`/`checkCambios`
  → `PaqueteDirectoryRoot.actualizarVersion` → `Paquete.applyUpdate`, abortando la actualización
  de cualquier framework que requiriese un merge de 3 vías. Este error solo se hizo visible
  gracias al fix anterior (`2026.7.2+2`) que persiste `Paquete.error` en el log.
  - `diff3@0.0.4` está sin mantenimiento (última publicación en 2016) y el bug no puede
    corregirse mediante `yarn patch` de forma portable, ya que el patch se aplica solo en
    el propio monorepo (no viaja con la dependencia a otros proyectos que consuman `@mr/cli`).
    En su lugar se ha sustituido por [`node-diff3`](https://www.npmjs.com/package/node-diff3)
    (mantenimiento activo, incluye sus propios tipos TypeScript), eliminando `diff3` y
    `@types/diff3` de `package.json` y añadiendo `node-diff3` como devDependency.
  - `utiles/merge.ts` ahora importa `{diff3Merge}` desde `node-diff3` en lugar del default
    export de `diff3`. La forma del resultado (`{ok: string[]} | {conflict: {a,o,b,...}}`) es
    compatible, por lo que el resto de la lógica de `merge3()` no ha cambiado.
  - También se ha eliminado la dependencia (no utilizada) `diff3`/`@types/diff3` de
    `framework/services-comun/package.json`, que quedó huérfana tras una refactorización
    anterior (`merge3` se movió a `@mr/cli/src/mrpack/utiles/merge.ts`).

---

## 2026.7.2+2

### Fixed — `framework/gestor/acciones.ts`, `framework/gestor/logs.ts`, `paquete/index.ts`

- **El error de `applyUpdate` no se veía reflejado en ningún sitio**: cuando la actualización
  de un framework fallaba (excepción durante la descarga o el merge), `applyUpdate` devolvía
  `entradas: []`, por lo que `ejecutarAcciones` nunca invocaba `escribirLog` y el log
  `tmp/log/<paquete>.pull.md` no se generaba (o quedaba con el contenido de una ejecución
  anterior). El usuario solo veía `[ERROR]` en la tabla de progreso sin ninguna pista adicional.
  - `Paquete` ahora expone `public error: string|undefined`, poblado en el `catch` de
    `applyUpdate` con `err.stack ?? err.message`.
  - `escribirLog()` acepta un nuevo parámetro opcional `error` y, si está presente, añade una
    sección `## Error` al log (antes de `## Salida del proceso`) con el mensaje/stack completo.
  - `ejecutarAcciones` ahora escribe el log también cuando `info.paquete.error !== undefined`
    (aunque `entradas` esté vacío) en los tres flujos de actualización (`instalar`, `actualizar`
    y `actualizar+enviar`), y añade un aviso `⚠` con la ruta al log. En `actualizar+enviar`,
    además, se omite el `push` del paquete si la actualización falló.

### Changed — `README.md`, `CODEMAP.md`

- Documentada la nueva sección `## Error` en los logs de actualización y el campo
  `Paquete.error`/parámetro `escribirLog(..., error)`.

---

## 2026.7.2

### Changed — `init.ts` · `workspace/service.ts`

- **Normalización de `build.bundler` con override manual permitido en Node**: cuando
  las reglas de coherencia dan como valor por defecto `esbuild`, `mrpack init` y el
  watcher de `mrpack.json` en `mrpack devel` ya no fuerzan el cambio si el usuario ha
  puesto `rspack` explícitamente. Se siguen forzando los casos estrictos:
  `browser -> rspack`, `php/cfworker -> none`, `node+nextjs -> none`, `node+componentes -> rspack`.

### Changed — `README.md`

- Se actualiza la documentación de `devel` para indicar que el modo watch usa el bundler
  configurado (`rspack` o `esbuild`) y la de `init` para reflejar las reglas de
  normalización de `build.bundler` con soporte de override manual a `rspack` en los
  escenarios Node cuyo valor por defecto sería `esbuild`.

---

## 2026.7.1+1

### Fixed — `framework/gestor/index.ts`

- **`actualizarTodo` solo muestra en la tabla los paquetes con update disponible**: en modo
  interactivo, `GestorTabla` recibía la lista completa de paquetes instalados (incluyendo los
  que ya estaban al día), mostrando filas innecesarias con la acción fija en `nada`. Ahora,
  siguiendo el mismo patrón que `enviarTodo` y `resetearTodo`, se filtra `infos` a los paquetes
  con `instalado && tieneUpdate` antes de construir la tabla, y las acciones elegidas se
  remapean al array completo para `ejecutarAcciones`. Afecta tanto a `yarn mrpack devel -c`
  (chequeo automático de frameworks) como a `yarn mrpack framework --update`.

### Changed — `README.md`

- Corregida la tabla de "Modos de tabla" (`--update` ahora indica "Solo con update disponible"
  en vez de "Todos") y ampliada la nota sobre `devel -c` para reflejar que la tabla de
  actualización de frameworks solo lista los paquetes con update pendiente.
- Añadida nota sobre el filtrado previo de `infos` en `actualizarTodo`, `enviarTodo` y
  `resetearTodo` en la sección de referencia de `GestorTabla`.

---

## 2026.6.30+3

### Fixed — `init.ts`

- **Limpieza de `@mr/cli/bin/mrdev.js` durante `mrpack init`**: en la fase de borrado de
  archivos innecesarios (`deleteFiles`) se añade `@mr/cli/bin/mrdev.js` a la lista de
  artefactos legacy eliminables (junto a `@mr/cli/status.json`), para evitar que permanezca
  tras inicializar el monorepo.

### Changed — `README.md`

- Documentada la limpieza de artefactos legacy de `@mr/cli` (`status.json` y `bin/mrdev.js`)
  dentro de la sección del comando `mrpack init`.

---

## 2026.6.30+2

### Fixed — `config/datos.ts` · `init.ts`

- **Workspaces `nextjs` ahora aparecen en `devel.available` / `devel.disabled`**: la
  condición `ejecutable` en `leerCapacidades` (`config/datos.ts`) y en la regeneración de
  `config.workspaces.json` dentro de `mrpack init` (`init.ts`) requería erróneamente
  `framework === "meteored"`, excluyendo los proyectos Next.js.
  Se simplifica a `runtime === "node"`, alineándola con la lógica real de
  `Service.checkEjecucion` que solo excluye los runtimes `browser`, `cfworker` y `php`.
  Los proyectos Next.js con `deploy.runtime = "node"` ya aparecen en las listas y pueden
  activarse o desactivarse desde `mrpack config` y al ejecutar `mrpack init`.

### Changed — `config/workspaces.ts`

- JSDoc de `filtrarPorClave` y `gestionarLista` actualizados para reflejar las nuevas
  reglas de visibilidad de la lista `devel`.

---

## 2026.6.30+1

### Fixed — `framework/gestor/tabla.ts` · `utiles/tty.ts`

- **Bordes descuadrados en el panel diff cuando el autor contiene acentos**: en macOS,
  git puede devolver nombres de autor en forma NFD (Unicode descompuesto), donde p.ej.
  `í` = `i` + combining acute → `.length` = 2 pero ocupa 1 columna en el terminal.
  Se añade `anchoVisible(str)` en `utiles/tty.ts` (elimina códigos ANSI y normaliza a NFC
  antes de contar) y se usa en todos los puntos de cálculo de padding: `bordeado`,
  `indicadorScroll`, `panelMagenta.filaColoreada`, `panelMagenta.fila`, `filaTit` y
  `Render.contarFisicas`.

### Changed — `workspace/service.ts`

- **`PAUSABLES` incluye `BuildFW.nextjs`**: los workspaces con framework `nextjs` activan
  ahora el timeout de pausa del compilador (5 minutos de inactividad), igual que los
  workspaces con framework `meteored`. Antes solo los workspaces `meteored` se pausaban
  automáticamente.

- **`checkEjecucion` excluye `Runtime.php`**: los workspaces con `deploy.runtime = "php"`
  ya no pueden arrancarse en modo ejecución (`devel -e`). Se añade `Runtime.php` a la
  lista de runtimes excluidos junto a `Runtime.browser` y `Runtime.cfworker`, en
  coherencia con las reglas de visibilidad que ya aplicaban `mrpack config` y `mrpack init`.

---

## 2026.6.26+6

### Fixed — `init.ts`

- **Corrección de Dockerfile según runtime** (`src/mrpack/clases/init.ts`): durante
  `mrpack init`, la inserción de `ENV NODE_ENV=production` junto a `COPY ./yarn.lock ./`
  se aplica únicamente cuando `deploy.runtime === "node"`.

### Changed — Log HTML de push (`push-log.ts`)

- **Campo `proyecto` en el bloque de autoría HTML**: `IPushLogData` tiene el nuevo campo
  `proyecto: string`, rellenado con `getProyectoUrl(this.basedir)` (URL del remoto git sin
  credenciales) en paralelo con el procesado de ficheros dentro de `capturarDatosPush`.
  Se renderiza como enlace clicable en la tabla de metadatos del HTML.
  `getProyectoUrl` pasa a ser `export` en `root.ts` para permitir su reutilización.

- **Fecha en hora local con zona horaria**: la fecha del push ya no se muestra en UTC sino
  en la hora local del servidor que realizó el push, con zona horaria IANA y offset explícito.
  Ejemplo: `2026-06-26 14:32:07 Europe/Madrid (UTC+02:00)`.
  La lógica se extrajo a la función `formatearFechaLocal(fecha: Date): string`.

- **Logo Meteored en el bloque de autoría**: el header del HTML incluye el logo de Meteored
  (`https://www.meteored.com/img/web/meteored.svg`) en la esquina superior derecha, alineado
  con el título mediante flex (`header-top`).

- **Header sticky con compactación al scroll**: el bloque de autoría es `position: sticky;
  top: 0` y se compacta (solo muestra título y logo) al hacer scroll. El colapso se
  gestiona mediante `IntersectionObserver` sobre un `<div id="scroll-sentinel">` de altura 0
  situado justo debajo del header (evita el feedback loop del scroll anchoring).
  `body { overflow-anchor: none }` desactiva el scroll anchoring para prevenir oscilaciones.

- **Botón "volver arriba"**: `<button id="back-top">` fijo en la esquina inferior-derecha,
  visible solo cuando el header está compacto; hace `scrollTo({top:0, behavior:'smooth'})`.

- **Exclusión de `bin/min/*` de los diffs**: los ficheros en `bin/min/` no se incluyen en
  la sección de detalle de cambios, igual que hace `GestorTabla.esDiffable` en `tabla.ts`.
  El array `diffables` (cambiados sin bin/min) se usa para el TOC y los diffs. El array
  `cambiados` completo sigue apareciendo en el contador y la lista de ficheros modificados,
  pero los ficheros `bin/min/*` no tienen enlace (se usa `diffIndexMap` para el mapeo).

- **Ruta GCS simplificada**: de `logs/{fw}/{YYYY-MM-DD}/{dt}_{ver}_{autor}.html` a
  `logs/{framework}/{version}.html` (nombre fw sanitizado, `+` → `_` en la versión).

- **Límite de líneas**: de 500 a 2000 líneas por fichero para el diff HTML
  (`MAX_DIFF_LINES_HTML`).

- **Links en lista de ficheros modificados**: cada ítem en la sección "Ficheros modificados"
  enlaza a su bloque `<details id="diff-N">` correspondiente; los ficheros sin diff
  (bin/min) aparecen sin enlace.

### Refactored — `push-log.ts`

- **`pad2`** extraída a nivel de módulo (antes definida inline dentro de `generarHtmlPush`).
- **`formatearFechaLocal`** nueva función de módulo que encapsula el formateo de fecha local.
- **`CSS_HTML_PUSH`** nueva constante de módulo con la hoja de estilos; `generarHtmlPush`
  referencia la constante en lugar de declarar `const css = \`…\`` en cada llamada.
- **`renderizarListaSimple`**: parámetro `conEnlaces: boolean` reemplazado por
  `diffIndexMap?: Map<string, number>`, permitiendo enlazar solo los ficheros con diff y
  dejando sin enlace los que están en `bin/min/`.

### Changed — exclusión de diffs adicionales

- **`CHANGELOG.md` y `CODEMAP.md` excluidos de los diffs HTML**: la función `esDiffable`
  (antes una expresión inline que solo filtraba `bin/min/`) se extrae como función de módulo
  y amplía los criterios de exclusión: `bin/min/**`, `**/CHANGELOG.md` y `**/CODEMAP.md`.
  Estos ficheros siguen apareciendo en el contador y la lista de "Ficheros modificados",
  pero sin enlace ni bloque de diff.

### Fixed — CODEMAP.md

- Eliminada la **duplicación completa** del fichero (todo el contenido aparecía dos veces).
- Sección `push-log.ts` actualizada: `IPushLogData` con `proyecto`, ruta GCS corregida,
  helpers internos documentados.
- Sección `root.ts` actualizada: `getProyectoUrl` exportada, campo `proyecto` en
  `IPaqueteDirectoryRoot` y en la clase.
- Grafo de dependencias y notas de convención actualizados con la ruta GCS real y la
  exclusión de `bin/min/*`.

---

## 2026.6.26+2

### Added

- **Log HTML de push** (`src/mrpack/clases/paquete/push-log.ts` — nuevo fichero):
  al hacer `send` de un framework, `mrpack` genera un fichero HTML auto-contenido con el
  detalle del push (autor, versiones, ficheros creados / eliminados / modificados y diff
  unificado de cada fichero cambiado) y lo sube al mismo bucket de GCS en la ruta:

  ```
  logs/{framework}/{YYYY-MM-DD}/{datetime}_{version}_{autor}.html
  ```

  El nombre del framework se sanitiza eliminando `@` y `/` para no crear subjerarquías
  en el bucket. El diff usa el algoritmo LCS con contexto de 3 líneas y se renderiza con
  CSS inline para Chrome; los bloques de autoría (`.ts`) se excluyen del diff.

  Método público añadido en `Paquete`:
  ```ts
  public async subirLogHtml(): Promise<void>
  ```
  llamado automáticamente desde `ejecutarAcciones` en las rutas de envío directo
  (`aEnviar`) y de actualizar+enviar (`aEnviarConUpdate`).

### Refactored

- **Algoritmo LCS centralizado en `utiles/diff.ts`** (nuevo fichero):
  el código LCS (`O(m·n)` DP + backtracking) estaba duplicado tres veces:
  en `GestorTabla.lcsOps`, en `GestorTabla.calcularDiff` y en `push-log.ts`.
  Ahora el núcleo se reside en:

  ```ts
  // utiles/diff.ts
  export function calcularDiffOps(aLines, bLines, maxLineas): IDiffRawOp[] | null
  export function indicesConContexto(ops, contexto?): Set<number>
  ```

  `tabla.ts` y `push-log.ts` llaman a estas funciones y solo añaden su propio
  formato de salida (ANSI para terminal, HTML para logs).

- **Primitivas TTY centralizadas en `utiles/tty.ts`** (nuevo fichero):
  la clase `Render` (dibujar/limpiar bloque de líneas con borrado preciso) y las
  funciones `prepararTTY`/`restaurarTTY` estaban definidas en `config/menu.ts` y
  duplicadas de forma interna en `GestorTabla._dibujarLineas`. Ahora:

  ```ts
  // utiles/tty.ts
  export class Render { dibujar(lineas): void; limpiar(): void; }
  export function prepararTTY(): void
  export function restaurarTTY(): void
  ```

  `menu.ts` los importa directamente desde `utiles/tty.ts`.
  `GestorTabla` usa `this.render: Render` en lugar de `_dibujarLineas` interna
  (eliminando ~30 líneas de lógica duplicada).

- **CODEMAP.md actualizado**: refleja `push-log.ts`, `diff.ts`, `tty.ts`,
  `elegirUno` (reemplaza la antigua `conmutar`, que ya no existe) y el diagrama
  de dependencias actualizado con los nuevos flujos.

---

## 2026.6.26+1

### Added

- **Campo `Proyecto` en el bloque de autoría de ficheros `.ts`** (`src/mrpack/clases/paquete/file.ts`,
  `directory.ts`, `root.ts`):
  al hacer `send` de un framework, `mrpack` obtiene la URL del repositorio git remoto
  (`git remote get-url origin`) y la añade como nueva línea al bloque de cabecera de
  cada fichero `.ts` modificado, eliminando previamente cualquier credencial embebida
  (`https://token@host` → `https://host`). Si el repositorio no tiene remoto configurado,
  la línea se omite sin error.

  El bloque resultante:

  ```typescript
  /**
   * Editor: José Antonio Jiménez
   * Fecha: Fri, 26 Jun 2026 08:00:00 GMT
   * Hash: abc123…
   * Versión: 2026.6.26+1-josantoniojimnez
   * Anterior: 2026.6.25+5-josantoniojimnez
   * Proyecto: https://github.com/alpred/meteored-web-www.git
   */
  ```

  `PATRON_AUTORIA` actualizado para reconocer (y excluir del hash) la nueva línea opcional.

- **Campo `proyecto` en `status.json`** (`src/mrpack/clases/paquete/root.ts`):
  el mismo valor se persiste en el `status.json` incluido dentro del ZIP subido a GCS.
  El campo solo aparece cuando la URL no está vacía. Al leer un ZIP antiguo sin el campo,
  `proyecto` se inicializa a cadena vacía y el ZIP se deserializa sin error.

  ```json
  {
    "autor": "José Antonio Jiménez",
    "fecha": "2026-06-26T08:00:00.000Z",
    "hash": "abc123…",
    "hijos": { "…": "…" },
    "version": "2026.6.26+1-josantoniojimnez",
    "proyecto": "https://github.com/alpred/meteored-web-www.git"
  }
  ```

---

## 2026.6.25+10

### Changed

- **`mrpack devel -c` — `patch:apply` siempre antes de compilar** (`src/mrpack/clases/devel.ts`):
  anteriormente los patches solo se aplicaban cuando `actualizarTodo` o `init` devolvían
  cambios (frameworks actualizados / instalados). Ahora `aplicarPatches(basedir)` se
  invoca **siempre** al final del bloque de inicialización, antes de arrancar los
  compiladores de los workspaces.

  Esto garantiza que, aunque no haya actualización de frameworks, los patches pendientes
  (detectados por la propiedad `config.patch` en `config.workspaces.json`) se apliquen
  en cada arranque de desarrollo. Si `patch:apply` detecta que el estado ya está al día,
  finaliza de inmediato sin trabajo adicional.

---

## 2026.6.25+9

### Added

- **Nuevo módulo `mrpack config`**: gestor interactivo de `config.workspaces.json`.
  Abre un menú TUI (modo raw, redibujado sin scroll) con dos opciones principales:

  #### Gestionar workspaces

  Submenú con tres acciones:

  | Acción | Descripción |
  |--------|-------------|
  | **Compilar** | Lista de checkboxes (↑↓ + Espacio) de los workspaces gestionables. Marcado → `packd.available` (se compila); desmarcado → `packd.disabled` (no se compila). |
  | **Ejecutar** | Ídem para `devel.available` / `devel.disabled`. |
  | **Generar i18n** | Selector de radio ON/OFF para `config.i18n`. Solo aparece habilitado si el directorio `i18n` existe en el monorepo. |

  **Reglas de visibilidad** (aplicadas también al inicializar con `mrpack init`):
  - Un workspace solo aparece en **Compilar** si `deploy.runtime !== "php"`.
  - Un workspace solo aparece en **Ejecutar** si `build.framework === "meteored"` **y** `deploy.runtime === "node"`.
  - Los workspaces que no cumplen la condición se eliminan de ambas listas al guardar.

  #### Gestionar frameworks

  Submenú con dos acciones:

  | Acción | Descripción |
  |--------|-------------|
  | **Autoupdates** | Selector de radio (`all` / `daily` / `weekly`) para `framework.updates`. El cursor arranca sobre el valor actualmente configurado. |
  | **Sistema de Patches** | Muestra el último patch aplicado (`config.patch`) y permite eliminarlo para forzar que `patch:apply` lo reaaplique en el próximo arranque. La opción "Eliminar patch" aparece deshabilitada si no hay ningún patch registrado. |

  #### Primitivas TUI reutilizables (`clases/config/menu.ts`)

  | Primitiva | Navegación | Uso |
  |-----------|-----------|-----|
  | `seleccionar<T>` | ↑↓, Intro confirmar, Esc/← cancelar | Menús de navegación |
  | `elegirUno<T>` | ↑↓, Intro/Espacio confirmar, Esc/← cancelar | Selectores de radio (◉/○) con descripciones tabuladas |
  | `alternarLista` | ↑↓, Espacio alternar, a/n todos/ninguno, Intro confirmar, Esc cancelar | Listas de checkboxes |

- **`mrpack init` — filtrado consistente de `config.workspaces.json`**: al inicializar o
  regenerar el fichero, se aplican las mismas reglas de visibilidad que en `mrpack config`:
  workspaces con `runtime = "php"` no se añaden a las listas de `packd`, y los de
  `framework ≠ "meteored"` o `runtime ≠ "node"` no se añaden a las listas de `devel`.
  Los `disabled` importados del fichero previo también se filtran por las mismas reglas.

---

## 2026.6.25+3

### Fixed

- `src/mrpack/clases/framework/gestor/acciones.ts` — la verificación de dependencias
  de frameworks (`add()`) ahora se realiza sobre **todos** los frameworks instalados
  antes de ejecutar `yarn install`, en lugar de solo sobre los modificados en el run
  actual (`aModificados`).

  **Causa raíz:** el bloque de resolución de deps solo revisaba `aInstalar`,
  `aActualizar` y `aResetear`. Si un framework ya instalado tenía una dep `@mr/*`
  faltante (p.ej. porque el run anterior se interrumpió antes de instalarla, o porque
  se añadió al package.json del framework sin que este se actualizara en este run),
  esa dep nunca se detectaba antes del `yarn install`, causando un error de dependencias.

  **Solución:** el bucle ahora itera sobre `infos.filter(i => i.instalado)` — todos
  los frameworks presentes en disco — y pasa sus deps a `add()`, que internamente
  descarta los que ya existan en disco y solo descarga los realmente faltantes.

---

## 2026.6.25+2

### Changed

- `src/mrpack/clases/init.ts` — se eliminan las entradas obsoletas `gaxios` y
  `node-fetch` del campo `resolutions`. `mrpack init` ya no inyecta ninguna
  resolución de compatibilidad para estas librerías.

- `package.json` (raíz del monorepo) — eliminada la entrada `resolutions` ya
  que no contiene entradas activas.

### Notes

- El problema con `node-fetch@2.x` (`ERR_STREAM_PREMATURE_CLOSE`) que afectaba a
  Node.js 24.0–24.17 quedó resuelto en **Node.js 24.18**. El shim provisional
  `shims/node-fetch/` introducido durante el desarrollo en 24.17 ha sido eliminado.
  Ver historial de la versión `2026.6.25+1` para los detalles técnicos de las
  incompatibilidades que resolvía.

---

## 2026.6.25+1 *(retirado — Node.js 24.18 resuelve el problema en el runtime)*

### Added *(revertido en +2)*

- `shims/node-fetch/` — shim CJS que re-exporta el `fetch` nativo de Node.js 18+
  con la misma interfaz que esperan `node-fetch@2.x`, `gaxios@6.x` y `teeny-request`.
  Solucionaba cinco incompatibilidades entre `node-fetch@2.x` y Node.js 24.0–24.17:

  | Problema | Causa |
  |----------|-------|
  | `ERR_STREAM_PREMATURE_CLOSE` | Node.js 24 emite este evento en streams Gunzip aunque todos los datos se recibieron; `node-fetch@2.x` rechaza la promesa |
  | `TypeError: responseStream.on is not a function` | Native fetch devuelve `response.body` como WHATWG `ReadableStream`; `teeny-request` y otros esperan Node.js Readable |
  | `Body is unusable: Body has already been read` | `teeny-request@9.x` hace `Object.assign(res.body, {...})` y luego llama `res.text()`; `Readable.fromWeb()` bloqueaba el stream al acceder a `.body` |
  | `RequestInit: Expected signal to be an instance of AbortSignal` | `gaxios@6.x` deep-clona el `AbortSignal` a `{}` con `extend()` |
  | `RequestInit: duplex option is required when sending a body` | Undici exige `duplex:'half'` y no acepta `Node.js Readable` directamente |

---

## 2026.6.24+3

### Fixed

- `bin/mrpack.js`, `bin/mrlang.js` — `MRPACK_ROOT` ahora se calcula desde `__dirname`
  en lugar de depender de `process.cwd()`.

  **Causa raíz:** Yarn PnP puede arrancar los bin-scripts desde el directorio del
  workspace (`@mr/cli/`) en lugar de desde la raíz del monorepo. Con `process.cwd()`
  como fuente de `MRPACK_ROOT`, `this.root` apuntaba a `@mr/cli/` y todas las rutas
  construidas como `${root}/@mr/cli/package.json` se duplicaban, produciendo
  `ENOENT: .../web-www/@mr/cli/@mr/cli/package.json`.

  **Solución:** los bins fijan `MRPACK_ROOT` antes de cargar `lib.js`:
  ```js
  process.env.MRPACK_ROOT = require("path").resolve(__dirname, "../../..");
  ```
  `__dirname` es siempre `@mr/cli/bin`; tres niveles arriba siempre es la raíz del
  monorepo, con independencia del cwd con que Yarn haya invocado el proceso.

---

## 2026.6.24+2

### Fixed

- `.run/update.run.xml`, `.run/push.run.xml`, `.run/tools.run.xml` — convertidos de
  `ShConfigurationType` (shell `/bin/zsh`) a `js.build_tools.npm` para corregir un error
  al ejecutarlos desde JetBrains cuando otro proyecto estaba activo simultáneamente:

  **Causa raíz:** con `ShConfigurationType`, `$PROJECT_DIR$` se resuelve al proyecto
  enfocado en ese momento en JetBrains. Si ese proyecto era otro (p.ej. `mr-tiempo`),
  `yarn mrpack update` se ejecutaba desde ese directorio; el `process.chdir('../..')`
  de `main.ts` aterrizaba dentro de la caché PnP de Yarn en lugar de en `web-www`, y
  todas las llamadas a `yarn` subsiguientes fallaban (`ERR_MODULE_NOT_FOUND`).

  **Solución:** `js.build_tools.npm` con `package-json` explícito ancla siempre el
  proyecto a `$PROJECT_DIR$/@mr/cli/package.json` y usa el intérprete Node configurado
  para el workspace (con PnP y nvm/fnm correctamente inicializados), igual que ya hacían
  `devel.run.xml` y `packd.run.xml`.

### Changed

- `.run/tools.run.xml` — script actualizado de `compile --watch` (rspack) a
  `compile:watch` (esbuild), en línea con la migración de bundler de `2026.6.24+1`.

---

## 2026.6.24+1

### Changed

- `src/esbuild.config.mjs` — el bundler de `@mr/cli` pasa de **rspack** a **esbuild**:
  - Tiempo de compilación: de ~2.8 s a **~0.85 s** (×3.3); esbuild puro tarda ~70 ms,
    el tiempo restante corresponde a `tsc --noEmit` que corre en paralelo.
  - Tamaño de `bin/min/mrpack-run.js`: de ~3.6 MB a **169 kB** (×21 más pequeño).
    La reducción se debe a que `typescript.js` (9 MB de fuente) ya no se bundlea
    inline — se marca como external igual que hacía `rspack.config.mjs`.
  - `target` actualizado a `node24`.
  - Sin chunks intermedios (`plugins/`, `482-run.js`): cada ejecutable queda en un
    único fichero autocontenido.
  - **Type checking en paralelo**: `tsc --noEmit` se lanza simultáneamente con el
    bundling. En modo build, el script falla (`exitCode = 1`) si tsc detecta errores
    de tipos. En modo watch, `tsc --noEmit --watch --preserveWatchOutput` corre como
    proceso hijo independiente mostrando errores en tiempo real.
  - `minify` desactivado en modo watch para acelerar los rebuilds.

- `package.json` — scripts de compilación actualizados:

  | Script | Comando | Descripción |
  |--------|---------|-------------|
  | `compile` | `node src/esbuild.config.mjs` | Build de producción con esbuild + tsc |
  | `compile:watch` | `node src/esbuild.config.mjs --watch` | Watch: rebuild automático + tsc --watch |
  | `compile:rspack` | `yarn rspack --config src/rspack.config.mjs` | Fallback al bundler anterior |

- `package.json` — añadida devDependency `esbuild@^0.28.1`.

---

## 2026.6.17+4

### Changed

- `src/mrpack/clases/workspace/service.ts` — formato del log `output/compilar.md` completamente renovado
  y extensión de funcionalidad respecto a la versión inicial (`2026.6.17+3`):
  - `appendLogCompilar(linea, tipo)` sustituido por `appendChunkLogCompilar(lineas, tipo)`:
    en lugar de añadir una entrada por línea, cada evento `data` del compilador (stdout o stderr)
    genera un único bloque fenced Markdown con todas sus líneas juntas.
  - Cada bloque va encabezado por la hora local en negrita (`**HH:MM:SS**`) seguido del
    bloque de código y un separador `---`.
  - Nuevo método privado `extractFileRefs(lineas)`: detecta referencias a ficheros de código
    (`.ts`, `.tsx`, `.js`, `.jsx`, `.mjs`, `.cjs`, `.scss`, `.css`, `.html`) con número de fila y
    columna opcionales, resuelve sus rutas absolutas (teniendo en cuenta que rspack corre desde
    `{root}/@mr/core/dev`), deduplica por ruta resuelta y ordena por nombre/fila/columna.
    - En el `.md`: los ficheros detectados se listan como enlaces relativos al final de cada bloque.
    - En el stdout: las rutas absolutas con `archivo:línea:columna` se imprimen vía `Log.info`
      para que sean clicables directamente desde la consola.
  - Las fechas y horas del `.md` (`iniciarLogCompilar`, `appendChunkLogCompilar`) usan
    **hora local** en lugar de UTC, mediante los helpers estáticos privados `horaLocal(d)` y
    `fechaHoraLocal(d)`.

- `src/mrpack/clases/log.ts` — el timestamp `[HH:MM:SS]` que precede a cada mensaje en la
  consola (`stdout`/`stderr`) usa ahora **hora local** en lugar de UTC:
  - Eliminada la dependencia de `Fecha.generarHora` (de `services-comun`).
  - Nueva función módulo privada `horaLocal(d)` que formatea con `getHours()` / `getMinutes()` /
    `getSeconds()` (métodos locales), con relleno de ceros con `padStart(2, "0")`.
  - `generarFechaLog` llama a `horaLocal(new Date())` en lugar de `Fecha.generarHora(new Date(), false)`.

---

## 2026.6.17+3

### Added

- `src/mrpack/clases/workspace/service.ts` — la salida del compilador en modo `devel -c` se
  persiste ahora en `output/compilar.md` dentro del workspace correspondiente, además de
  seguir mostrándose por consola:
  - Nuevo campo `logCompilarInicio: Promise<void> | undefined` para coordinar la escritura.
  - `iniciarLogCompilar()` — rota los ficheros antes de iniciar cada sesión:
    si existe `compilar-old.md` lo elimina, luego renombra `compilar.md` a `compilar-old.md`
    y crea el nuevo `compilar.md` con la fecha/hora de inicio. Así se conservan siempre
    la compilación actual y la anterior.
  - `appendLogCompilar(linea, tipo)` — añade cada línea de `stdout` tal cual (sin prefijo) y
    cada línea de `stderr` con el prefijo `[ERR] `, en ambos casos sin códigos ANSI.
  - El log se reinicia (sobreescribe) cada vez que el compilador arranca de nuevo.

---

## 2026.6.17+2

### Added

- `src/mrpack/clases/workspace/service.ts` — coordinación de dependencias de compilación en modo `devel -c`.
  Cuando un workspace declara `build.deps` en su `mrpack.json`, su compilador no arranca hasta que todos
  los workspaces de los que depende hayan emitido su primera compilación exitosa:
  - Nuevos campos privados: `depsPendientes: Set<string>`, `compilarListeners: (() => void)[]`,
    `primeraCompilacionEmitida: boolean`.
  - Nuevos métodos públicos: `registrarListenerCompilacion(cb)`, `inicializarDeps(serviciosPorNombre)`,
    `estaListoParaCompilar()`.
  - Nuevos métodos privados: `notificarCompilacionExitosa()`, `depResuelta(depNombre)`.
  - `checkCompilar()` devuelve `false` (con log `Esperando dependencias: …`) mientras `depsPendientes` no esté vacío.
  - El handler `stdout` del compilador detecta las líneas de éxito de rspack (`✓ Built in` / `✓ Compiled in` /
    `compiled successfully`) y dispara `notificarCompilacionExitosa()` una sola vez.
  - El handler `close` del compilador actúa de fallback: si el proceso termina sin haber emitido la señal de éxito,
    también llama a `notificarCompilacionExitosa()` para no bloquear indefinidamente a los dependientes.

- `src/mrpack/clases/devel.ts` — `ejecutarServices` reestructurada en tres fases para activar la coordinación:
  1. **Fase 1:** crear todas las instancias de `Service` (constructor, sin `init()` aún).
  2. **Fase 2:** `inicializarDeps()` para todos en paralelo → conecta el grafo de dependencias.
  3. **Fase 3:** `init()` para todos en paralelo → los compiladores con `build.deps` pendientes esperan automáticamente.

### Changed

- `src/mrpack/modulos/devel.ts` — `mrpack devel` muestra la ayuda si no se pasa `-c` ni `-e`
  (antes arrancaba `run()` sin argumentos útiles).

---

## 2026.6.17+1

### Changed

- `src/mrlang/clases-v2/modulo/translation/literal.ts`, `src/mrlang/clases-v2/modulo/translation/map.ts` y `src/mrlang/clases-v2/modulo/translation/set.ts` — la generacion de valores de tipo `plural` deja de importar reglas desde `make-plural/cardinals` y pasa a construirlas con `pluralBuilder(...)` de `services-comun/modules/traduccion/v2/util/plural-function-builder`, unificando la resolucion de pluralizacion con `Intl.PluralRules` y sus fallbacks.

- `src/mrlang/clases/init.ts` — el `package.json` generado para el workspace de i18n ya no anade `make-plural` en `devDependencies`.

- `bin/hash.md5` — actualizado el hash del binario del CLI tras recompilar con estos cambios.

---

## 2026.6.16+5

### Changed

- `src/mrlang/clases-v2/lang/assets/langs.json` — actualización de mantenimiento del catálogo de idiomas: el código del serbio en alfabeto cirílico se normaliza de `sr-Cyr` a `sr-Cyrl`, y se ajusta también su `path` asociado para mantener la coherencia con el identificador corregido.

---

## 2026.6.16+4

### Fixed

- `src/mrlang/clases-v2/modulo/translation/literal.ts` y `src/mrlang/clases-v2/modulo/translation/set.ts` — los generadores de traducciones ya no mantienen una copia desactualizada de `pascalCase`. Ahora reutilizan `src/mrlang/clases-v2/util/case.ts`, de modo que los identificadores con dígitos conservan el mismo comportamiento corregido en todas las salidas generadas.

---

## 2026.6.16+3

### Fixed

- `src/mrlang/clases-v2/util/case.ts` — `pascalCase` ya no trata los dígitos como separadores al usar su regex por defecto. Ahora conserva fragmentos numéricos dentro de cada palabra, evitando salidas incorrectas al convertir cadenas como `v2` o `api-2026` a PascalCase.

---

## 2026.6.16+2

### Added

- `deployment/std/cloud-run-job.yml` — añadida la variable de entorno `CLOUD_RUN_REGION` para permitir que los jobs de Cloud Run accedan a la región de ejecución.
- `deployment/std/cloud-run-service.yml` — añadida la variable de entorno `CLOUD_RUN_REGION` para permitir que los servicios de Cloud Run accedan a la región de ejecución.
- `deployment/std/kustomizar.sh` — exportación de la variable de entorno `CLOUD_RUN_REGION` para que esté disponible en los manifiestos de despliegue.

---

## 2026.6.16+1

### Fixed

- `deployment/std/kustomizar.sh` — corregida la URI de Cloud Scheduler para ejecutar jobs de Cloud Run: se elimina el sufijo `-${ZONA}` del nombre del job en la ruta (`${KUSTOMIZER}-${SERVICIO}`), alineándolo con el identificador real usado en `jobs/...:run` y evitando invocaciones a recursos inexistentes.

---

## 2026.6.12+2

### Fixed

- **Windows — `spawn yarn ENOENT`**: todos los `spawn` que invocan `yarn` (y otros ejecutables
  instalados como wrappers `.cmd`) ahora pasan `shell: process.platform === "win32"` para que
  `CreateProcess` los encuentre sin necesidad de shell en Linux/macOS. Afecta a:
  `clases/comando.ts`, `clases/yarn.ts`, `clases/workspace/service.ts`,
  `clases/workspace/i18n.ts`, `clases/framework/cliente.ts`, `clases/patches.ts` y `bin/lib.js`.

- **Windows — enlace simbólico `.github` (`EPERM`)**: los enlaces de directorio requieren
  privilegios de administrador en Windows. `clases/init.ts` crea ahora una **junction** en
  Windows (con ruta absoluta) y un symlink relativo en el resto de plataformas. La detección
  del enlace existente usa `readlink()` en lugar de `lstat().isSymbolicLink()` porque las
  junctions devuelven `false` en esa propiedad.

- **Windows — detección de cambios en frameworks (Google Cloud Storage `invalid_grant`)**:
  `paquete/storage.ts` — el método `getZIP()` no tenía lógica de reautenticación; cuando el
  token de ADC expiraba en Windows, la solicitud fallaba con `status 400 / invalid_grant` y el
  error quedaba silenciado (`.catch(() => false)`), haciendo que `checkCambiosLocales` siempre
  devolviera `false`. Solución:
  - Nuevo método estático `esErrorDeAuth()` que reconoce todos los patrones conocidos de error
    de credenciales: `"storage.objects.get"`, `"invalid_grant"`, `"UNAUTHENTICATED"`,
    `"default credentials"` y `"PERMISSION_DENIED"`.
  - Nuevo método estático `login()` con promesa singleton compartida (`_loginPromise`) para
    evitar múltiples procesos `gcloud auth` simultáneos.
  - Nuevo método privado `_getZIPConLogin()` con el mismo patrón de reintento que ya tenía
    `_fetchListaConLogin()`.

- **Node 24 — aviso `DEP0190`**: suprimido en `bin/lib.js` junto al ya existente `DEP0040`
  (pasar un array de argumentos con `shell: true` emite este aviso en Node ≥ 24).

- **Envío de frameworks — autoría git**: `clases/framework/cliente.ts` hace ahora fallback
  escalonado para resolver el autor (`git config user.name` local, luego global y por último
  `GIT_AUTHOR_NAME`/`USERNAME`). Si no encuentra ningún valor, muestra además instrucciones
  explícitas para configurar `git config --global user.name` antes de reintentar.

- **Envío de frameworks — check preventivo de autor**: `clases/framework/gestor/acciones.ts`
  valida la autoría git al inicio cuando hay acciones `enviar`/`enviar+update`, para fallar
  rápido antes de ejecutar instalaciones, updates, resets o recompilaciones.

---

## 2026.6.12+1

### Added

- `paquete/root.ts` — nuevo método público `getAutorArchivo(relativePath)` que recorre el árbol
  del `status.json` y devuelve el `autor` del fichero indicado (o `undefined` si no está
  registrado). Funciona para todos los tipos de fichero, no solo `.ts`.

- `paquete/index.ts` — `getDiffFichero` y `getDiffFicheroDesdeRemoto` devuelven ahora también
  el campo `autor: string`, obtenido del `status.json` del ZIP correspondiente (base o remoto).

- `tabla.ts` — el título del visor de diff muestra el nombre del autor del cambio:
  - Diff local (`enviar`): autor del ZIP base (quien publicó la versión base).
  - Diff remoto (`actualizar`): autor del ZIP remoto (quien introdujo el cambio entrante).
  - Diff side-by-side (`ambos`): autor del lado remoto.

  El nombre del fichero se muestra en magenta brillante y el autor en `·  por <nombre>` en
  cyan/dim a continuación. La funcionalidad cubre todos los tipos de fichero, no solo `.ts`,
  ya que la fuente es `status.json` y no el bloque de autoría del fichero.

### Fixed

- `paquete/root.ts` / `paquete/directory.ts` / `paquete/file.ts` — corregido bug por el que el
  campo `autor` de todos los ficheros modificados quedaba como `"check"` en el `status.json`
  generado al publicar mediante la ruta con snapshot (`checkCambiosLocales` + `push`):

  1. `paquete/directory.ts` — nuevo método `corregirAutoresHashCambio(autor)` que recorre
     recursivamente todos los nodos con `hashCambio === true` y les asigna el autor real.
  2. `paquete/root.ts` — `actualizarAutor(versionBase, autor)` llama ahora a
     `corregirAutoresHashCambio(autor)`, reemplazando el `"check"` provisional dejado por el
     escaneo previo de `checkCambiosLocales`. La ruta sin snapshot no tenía el bug porque
     `calcularHashCambiado(status, autor)` ya recibía el autor real.
  3. `paquete/file.ts` — `inyectarAutoria` actualiza también `this.autor = autor`, de modo
     que los ficheros `.ts` queden correctamente sellados antes de empaquetar.

- `tabla.ts` — la tecla `d` (ver cambios) ya no se activa sobre frameworks no instalados.
  Su `tieneUpdate` podía ser `true` (versión base `0.0.0+0`, siempre detrás del remoto), pero
  sin directorio local la operación no tiene sentido y devolvía una lista vacía.

- `tabla.ts` — `_dibujarLineas` usa ahora **filas físicas** en lugar de líneas lógicas para
  calcular cuánto subir el cursor entre redibujos. Cuando el contenido supera el ancho del
  terminal y las líneas hacen wrap automático, la cuenta de filas lógicas era menor que las
  filas físicas reales: el cursor quedaba corto en uno o más filas y la primera línea del
  dibujo anterior no se sobreescribía, apareciendo "duplicada" en cada interacción. Ahora se
  calcula `ceil(longitudVisible / anchoTerminal)` por línea para obtener las filas físicas
  reales. Se añade también `\r` antes del `Colors.up` inicial para garantizar que el cursor
  está en columna 0 antes de subir, mejorando la consistencia entre terminales.

### Changed

- `tabla.ts` — en el modo `"todos"` (`yarn mrpack framework` sin parámetros), la acción por
  defecto es ahora siempre `nada`. Antes se preseleccionaba `actualizar` cuando había update
  disponible (igual que en el modo `--update`). El modo `--update` mantiene su comportamiento
  de preselección automática según la política `frameworkUpdates`.

---

## 2026.6.11+2-josantoniojimnez

### Fixed

- `src/mrpack/clases/framework/gestor/acciones.ts` — la resolución de dependencias
  `@mr/*` tras operaciones de framework ahora cubre también los paquetes **actualizados**
  (`aActualizar`) y **reseteados** (`aResetear`), no solo los recién instalados
  (`aInstalar`). Una actualización o reset puede introducir nuevas `devDependencies`
  `@mr/*` que antes no existían; si alguna no está presente localmente se descarga e
  instala antes de ejecutar `yarn install`.

---

## 2026.6.11+1-josantoniojimnez

### Added

- `src/mrpack/clases/framework/cliente.ts` — nuevas funciones exportadas para gestión
  de dependencias:

  - **`leerDepsMrFramework(localDir)`**: lee el `package.json` del directorio indicado y
    devuelve la lista de sus `devDependencies` de tipo `@mr/*` convertidas al formato
    argumento de `add()` (`@mr/core/X`, `@mr/user/X`).

  - **`encontrarWorkspacesConDep(basedir, npmName)`**: expande los patrones de workspaces
    del `package.json` raíz y devuelve los directorios que declaran `npmName` en
    `dependencies`, `devDependencies` o `peerDependencies` (excluyendo el propio paquete).

  - **`limpiarDevDepsConsumidores(basedir, npmNames)`**: elimina los npm names indicados
    de las `devDependencies` de todos los workspaces consumidores del monorepo
    (`services/`, `cronjobs/`, `jobs/`, `packages/`). Si `devDependencies` queda vacío,
    lo elimina del objeto.

- `src/mrpack/clases/framework/cliente.ts` — función privada auxiliar
  `encontrarDirsWorkspace(basedir)`: expande los patrones de workspaces del
  `package.json` raíz (`@mr/core/*`, `services/*`, etc.) y devuelve los directorios
  absolutos que contienen un `package.json`.

### Changed

- `src/mrpack/clases/framework/cliente.ts` — `add(basedir, frameworks, visitados?)`:
  - Acepta ahora un tercer parámetro opcional `visitados: Set<string>` para rastrear
    los paquetes ya procesados y evitar ciclos en la resolución de dependencias.
  - Tras cada `pullPackage` exitoso, lee las `devDependencies` `@mr/*` del framework
    recién instalado con `leerDepsMrFramework` y llama recursivamente a `add()` para
    instalar las que falten (y las suyas propias a su vez).

- `src/mrpack/clases/framework/gestor/acciones.ts` — `ejecutarAcciones`:

  - **Resolución de dependencias al instalar**: tras el bloque paralelo de instalaciones
    y antes de `yarn install`, recorre los paquetes recién instalados con
    `leerDepsMrFramework` y llama a `add()` para instalar las dependencias `@mr/*`
    ausentes, con resolución recursiva de sus transitivas.

  - **Validación y limpieza al desinstalar** (reemplaza la lógica anterior):
    1. Construye el mapa inverso de dependencias entre todos los frameworks instalados
       leyendo sus `package.json` en paralelo.
    2. Calcula iterativamente qué frameworks pueden desinstalarse: un framework puede
       desinstalarse si todos los frameworks que dependen de él también se van a
       desinstalar. Se repite hasta estabilidad para propagar bloqueos en cadena.
    3. Muestra aviso `⚠` para los frameworks bloqueados.
    4. Para los que pasan la validación: llama a `limpiarDevDepsConsumidores` para
       eliminar sus entradas de `devDependencies` en `services/`, `cronjobs/`, `jobs/`
       y `packages/`, y a continuación elimina sus directorios.

  - **`necesitaInstall`**: ahora usa `realmDesinstalar.length` (desinstalaciones que
    pasaron la validación) en lugar de `aDesinstalar.length`, evitando un `yarn install`
    innecesario cuando todos los intentos de desinstalación fueron bloqueados.

- `src/mrpack/clases/framework/index.ts` — re-exporta las nuevas funciones
  `leerDepsMrFramework`, `encontrarWorkspacesConDep` y `limpiarDevDepsConsumidores`.

---

## 2026.6.4+1-josantoniojimnez

### Added

- `.vscode/` (dentro de `@mr/cli`) — nuevas configuraciones compartidas de VS Code (`tasks.json` y `launch.json`) integradas para el multi-root workspace. Permiten ejecutar las tareas de `mrpack` y depurar el CLI de manera unificada.

### Changed

- `src/mrpack/clases/init/ignore.ts` — eliminada la exclusión de directorios `.vscode` (`**/.vscode/**`) de la plantilla del `.gitignore` generado, permitiendo compartir cómodamente estas configuraciones de desarrollo entre diferentes proyectos.

---

## 2026.6.3+3


### Added

- `src/mrpack/clases/patches.ts` — nuevo módulo compartido con la función exportada
  `aplicarPatches(basedir)`, que ejecuta `yarn run patch:apply` con `stdio: "inherit"`
  (la salida se muestra en tiempo real durante la ejecución).

### Changed

- `src/mrpack/clases/framework/gestor/acciones.ts` — `ejecutarAcciones` ahora llama
  a `aplicarPatches` de forma automática en dos puntos del flujo, siempre **antes**
  de `recompilarCliente` para que la compilación del CLI incorpore ya los cambios
  introducidos por los patches:
  1. Tras `yarn install` del flujo principal (instalar, actualizar, resetear o desinstalar).
  2. Tras `yarn install` del flujo de resolución de conflictos de merge.

- `src/mrpack/clases/update.ts` — eliminada la función local `patchApply` (que capturaba
  la salida con `Comando` y la imprimía al final). Ahora importa y usa `aplicarPatches`
  desde `./patches`, unificando el comportamiento con el gestor de frameworks.

---

## 2026.6.3+2

### Changed

- `src/mrpack/clases/workspace/service.ts` — `IConfigServices` añade el campo opcional
  `patch?: string` para persistir el último patch aplicado en `config.workspaces.json`.

- `src/mrpack/clases/init.ts` — al regenerar `config.workspaces.json`, ahora conserva
  el cursor `patch` (si existe y cumple formato `RXXX`) en lugar de descartarlo.

---

## 2026.6.3+1

### Changed

- Documentación operativa de monorepo actualizada para explicitar que los workspaces
  `@mr/cli`, `@mr/core/*`, `@mr/user/*` y `framework/*` se consideran **frameworks** y que
  su ciclo de actualización/publicación se realiza con `yarn mrpack framework` y
  `yarn mrpack framework --send`.

---

## 2026.6.1+2

### Added

- `src/mrlang/clases-v2/lang/assets/langs.json` — nuevo catálogo de idiomas con la cadena de
  herencia (`parent_code`) para resolver fallback por jerarquía.

- `src/mrlang/clases-v2/lang/lang.ts` — nueva clase `Lang` para cargar el catálogo en memoria,
  resolver idioma por código y navegar al idioma padre.

### Changed

- `src/mrlang/clases-v2/generate.ts` — en la generación de literales, el valor ya no se resuelve
  solo con `lang` y `defecto`: ahora recorre la jerarquía (`lang` -> `parent` -> ...) antes de
  aplicar el fallback final a `defecto`.

- `src/mrlang/clases-v2/generate.ts` y `src/mrlang/clases-v2/lang/lang.ts` — añadida documentación
  TSDoc en clase, métodos y estructuras usadas por el flujo de generación de traducciones.

---

## 2026.6.1+1

### Fixed

- `deployment/std/kustomizar.sh` — corregida la asignación de la anotación
  `run.googleapis.com/network-interfaces` en `yq`: el valor JSON ya no se inyecta
  con comillas simples (que rompían el lexer de `yq` con `invalid input text`),
  sino vía variable de entorno + `strenv(...)`, evitando errores de parseo cuando
  `network`/`subnetwork` contienen texto válido.

---

## 2026.5.27+3

### Changed

- `clases/manifest/workspace/deployment/lambda/index.ts` — `ManifestWorkspaceDeploymentLambdaLoader`
  actualizado para inicializar y validar la nueva propiedad `vpc`:
  - `default` incluye `vpc: false`.
  - `check()` copia el valor booleano `lambda.vpc ?? false` al resultado normalizado.

---

## 2026.5.27+2

### Added

- `clases/manifest/workspace/deployment/lambda/index.ts` — nuevo loader
  `ManifestWorkspaceDeploymentLambdaLoader` que valida y normaliza la sección `deploy.lambda`
  del `mrpack.json`. Aplica el default `ingress: "internal-and-cloud-load-balancing"` cuando
  el campo no está presente, y descarta valores de `egress`/`ingress` fuera del enum permitido.

### Changed

- `clases/manifest/workspace/deployment/index.ts` — cuando `deploy.target` es `"lambda"`,
  `check()` ahora hidrata `data.lambda` mediante `ManifestWorkspaceDeploymentLambdaLoader`:
  - Si el manifest incluye `lambda`, se valida y normaliza con `check(data.lambda)`.
  - Si no lo incluye, se aplica el valor por defecto con `.default`.

---

## 2026.5.26+1

### Changed

- `clases/framework/index.ts` — eliminado el sufijo redundante `/index` en el re-export del
  gestor (`from "./gestor"`), tras borrar el fichero legado `clases/framework/gestor.ts`.

- `clases/framework/gestor/tabla.ts` — integrada la utilidad compartida
  `utiles/output-capture.ts` para capturar salida externa durante el modo interactivo y
  mostrarla al finalizar la tabla.

### Fixed

- `clases/framework/gestor/tabla.ts` — corregido el redibujado incremental de la tabla:
  `Colors.up(...)` quedaba interceptado y no movía el cursor, provocando que cada pulsación
  imprimiera un bloque nuevo en el scroll. Ahora toda la secuencia de pintado se ejecuta con
  el flag interno de dibujado activo.

- `clases/framework/gestor/acciones.ts` y `clases/framework/cliente.ts` — tras ejecutar acciones
  de `instalar`, `actualizar`, `resetear` o `desinstalar`, se lanza `yarn install` antes de
  una posible recompilación de `@mr/cli`, y también tras resets en la tabla de conflictos.
  Además, `recompilarCliente(...)` acepta `skipInstall` para evitar instalaciones duplicadas.

---

## 2026.5.25+1

### Fixed

- `paquete/index.ts` — `calcularHashCambiado()` ahora llama a `reloadPaquete()` antes de
  modificar `this.paquete`. Sin este reload, si el usuario editaba `package.json` en disco
  (p. ej. añadiendo una dependencia) después de que el CLI cargara el `Paquete`, `savePaquete()`
  sobreescribía esos cambios con el contenido antiguo en memoria antes de escanear el árbol,
  provocando que el hash coincidiera con el remoto y el CLI reportara "no hay cambios" al enviar.

---

## 2026.5.22+2

### Fixed

- `workspace/service.ts` — `checkEjecucion()` ahora comprueba `config.enabled` igual que
  `checkCompilar()`. Cuando el `mrpack.json` del workspace tiene `enabled: false`, el servicio
  ya no se lanza en modo `devel` (antes se ignoraba solo la compilación, pero la ejecución
  seguía arrancando).

---

## 2026.5.22+1

### Fixed

- `paquete/index.ts` — corregido bug en `reset()` por el que, tras restaurar todos los
  ficheros del ZIP vía `resetearVersion()`, se llamaba a `savePaquete()` con el contenido
  antiguo de `this.paquete` en memoria (solo con la versión actualizada), sobreescribiendo el
  `package.json` correcto que `resetCambios` acababa de escribir desde el ZIP.
  Consecuencia: dependencias nuevas o modificadas en el `package.json` remoto (p. ej.
  `"sass-embedded": "^1.99.0"`) desaparecían después de un reset.

  **Solución:** tras `resetearVersion()`, se recarga `this.paquete` desde disco con
  `reloadPaquete()` y se elimina la llamada a `savePaquete()` (el fichero ya está correcto).

---

## 2026.5.21+6

### Added

- `config.workspaces.json` — nueva propiedad `framework.updates` con tres valores posibles:

  | Valor | Comportamiento en `yarn mrpack devel -c` |
  |-------|------------------------------------------|
  | `"all"` *(por defecto)* | Todos los paquetes con update disponible quedan **preseleccionados en `actualizar`** |
  | `"daily"` | Solo se preselecciona `actualizar` si la versión instalada lleva **1 día o más** publicada; en caso contrario, preselecciona `nada` |
  | `"weekly"` | Igual que `daily` pero con umbral de **7 días** |

  Un valor no reconocido en el fichero se normaliza automáticamente a `"all"`.
  La propiedad se escribe automáticamente al ejecutar `mrpack init` si no existía.

- `workspace/service.ts` — nuevo `const enum FrameworkUpdates` (`all` / `daily` / `weekly`) y
  función exportada `sanitizeFrameworkUpdates(value)` que garantiza que cualquier valor leído del
  JSON sea uno de los tres permitidos (convierte el resto a `"all"`).

- `paquete/index.ts` — nuevo método público `getVersionesRemota(): Promise<string[]>` que devuelve
  (y cachea en `_listaCache`) el historial completo de versiones de `stable.txt`. La detección de
  franja temporal en `daily`/`weekly` comprueba si la versión local está en este historial antes de
  evaluar su antigüedad: si no aparece (publicada hace más de 7 días), se preselecciona `actualizar`.

- `framework/gestor.ts`
  - `IPaqueteGestion` — nuevo campo `versionesRemota: string[]` con el historial descargado de
    `stable.txt`.
  - `GestorTabla` — nuevo tercer parámetro `frameworkUpdates` en el constructor
    (defecto `FrameworkUpdates.all`); añadido método privado `debeActualizar(info)` que aplica
    la política elegida.
  - `parsearFechaVersion(version)` — función módulo privada que extrae la fecha UTC del campo
    `YYYY.MM.DD` de una cadena de versión; usada por `debeActualizar`.
  - `actualizarTodo` — nuevo cuarto parámetro `frameworkUpdates`, propagado a `GestorTabla`.

- `devel.ts` — lee `config.workspaces.json` antes de llamar a `actualizarTodo` y pasa
  `framework.updates` (sanitizado) al gestor de frameworks.

---

## 2026.5.21+5

### Added

- `paquete/index.ts` — `stable.txt` pasa de contener una única versión a contener el
  historial de versiones publicadas en los **últimos 7 días**, una por línea, de más reciente
  a más antigua. Al publicar (`subirLatest`), se descarga la lista actual sin caché, se
  antepone la nueva versión, se eliminan duplicados y se descartan las entradas con fecha de
  publicación anterior a los 7 días. La versión actual siempre queda incluida aunque caiga
  justo en el límite.

  Los consumidores existentes siguen recibiendo la primera línea como versión más reciente,
  por lo que el cambio es completamente compatible con ficheros de una sola línea (formato
  anterior).

---

## 2026.5.21+4

### Added

- `deployment/std/kustomizar.sh` — soporte para `deploy.annotations.service` en el
  `mrpack.json` del workspace. Cada clave/valor del mapa se inyecta en
  `metadata.annotations` del manifiesto generado para Cloud Run.

### Changed

- `src/mrpack/clases/manifest/workspace/deployment/index.ts` — el loader de `deploy`
  conserva y propaga la propiedad `annotations` al modelo normalizado del workspace.

---

## 2026.5.21+3

### Added

- `paquete/directory.ts` — nuevo fichero marcador `.mr-nohash`. Cuando existe en un
  directorio del paquete, lista (una entrada por línea) los hijos —archivos o subdirectorios—
  cuya hash **no contribuye** al hash del directorio padre. Los hijos marcados se incluyen
  normalmente en el ZIP al publicar, pero los cambios en ellos no disparan la detección de
  cambios del paquete.

  Ejemplo: colocar `bin/.mr-nohash` con contenido `min` hace que las modificaciones en
  `bin/min/` no generen una nueva versión del paquete.

### Fixed

- `paquete/index.ts` — `savePaquete()` pasaba `safeWrite(…, true)` sin el cuarto parámetro
  `excepcion`. Si el renombrado atómico del fichero temporal fallaba (p.e. por un problema de
  disco transitorio), la función devolvía `false` en silencio y `package.json` quedaba con la
  versión **anterior** a pesar de que el ZIP ya había sido subido a GCS. La siguiente ejecución
  descargaba el ZIP antiguo, detectaba diferencias y marcaba el paquete como pendiente de envío
  de forma indefinida. Corregido pasando `excepcion: true` para que el error se propague.

---

## 2026.5.21+2

### Changed

- `modulos/framework.ts` — añadido flag `-y` / `--yes`. Cambia el comportamiento de
  `--update`, `--reset` y `--send`:

  | Comando | Sin `-y` (nuevo) | Con `-y` (antes era el único comportamiento) |
  |---------|-----------------|----------------------------------------------|
  | `--update` | Tabla interactiva con solo "nada" / "actualizar"; paquetes con update preseleccionados | Actualiza todos directamente sin tabla |
  | `--reset`  | Tabla interactiva con solo "nada" / "resetear"; instalados preseleccionados | Resetea todos directamente sin tabla |
  | `--send`   | Tabla interactiva con solo "nada" / "enviar"; paquetes con cambios preseleccionados | Envía todos directamente sin tabla |

- `clases/framework/gestor.ts`:
  - Añadido tipo `GestorModo` (`"todos" | "update" | "reset" | "send"`) que reemplaza el
    parámetro `soloUpdate: boolean` del constructor de `GestorTabla`.
  - `GestorTabla` adapta `slots`, acciones disponibles, valores por defecto de fila, ancho,
    y shortcuts de teclado (`a`, `r`, `e`) según el modo activo.
  - `enviarTodo(basedir, forzar, reiniciar)` — nuevo parámetro `forzar`. Con `forzar=false`,
    filtra los paquetes con cambios locales y muestra la tabla en modo `"send"`.
  - `resetearTodo(basedir, forzar, reiniciar)` — nuevo parámetro `forzar`. Con `forzar=false`,
    filtra los paquetes instalados y muestra la tabla en modo `"reset"`.

---

## 2026.5.21+1

### Fixed

- `bin/lib.js` — suprimido el warning `[DEP0040] DeprecationWarning: The punycode module is
  deprecated` que emitía Node 24 al arrancar `mrpack`. El origen es la cadena de dependencias
  transitivas `dd-trace` + `@google-cloud/storage` → `node-fetch@2.7.0` → `whatwg-url@5.0.0`
  → `tr46@0.0.3` → `require('punycode')`. Actualizar `tr46@0.0.3` requeriría romper
  `node-fetch@2.x` (dependencia interna de `gaxios` / `teeny-request`), por lo que se
  intercepta `process.emit` al inicio del proceso y se filtra únicamente el código `DEP0040`,
  dejando pasar todos los demás warnings.

- `comando.ts` — cambiado el valor por defecto de `shell` de `true` a `false`. Con `shell: true`
  y args pasados como array, Node 24 emite `[DEP0190] DeprecationWarning: Passing args to a child
  process with shell option true can lead to security vulnerabilities`. Como el comando y los
  parámetros siempre se pasan por separado (array), el shell no es necesario para expandir ningún
  patrón; pasar directamente el ejecutable es la forma segura y recomendada.

- `workspace/service.ts` — cambiado `shell: true` a `shell: false` en el `spawn` de
  `initEjecutar`. Mismo motivo que el cambio anterior: `"yarn"` + `["run", nombre, "run", "devel"]`
  son argumentos limpios que no necesitan expansión de shell.

---

## 2026.5.20+1

### Fixed
- [Jose] `paquete/index.ts` — el `package.json` incluido en el ZIP generado por `subirPaquete`
  contenía todavía la versión **anterior** porque `this.paquete.version` se actualizaba y se
  guardaba a disco **después** de llamar a `subirPaquete`. Los dos bloques `if (!Paquete.SIMULAR)`
  se han fusionado en uno y se ha reordenado la secuencia de operaciones:
  1. `this.version = status.version` (nueva versión en memoria)
  2. `prepararParaPush(autor)` (inyecta autorías en los `.ts`)
  3. `this.paquete.version = this.version` + `savePaquete()` → **`package.json` en disco actualizado**
  4. `subirPaquete(status)` → el ZIP ya contiene el `package.json` con la versión nueva
  5. `subirLatest()`

  Cuando `Paquete.SIMULAR = true`, el bloque `else` actualiza `paquete.version` y llama a
  `savePaquete()` como antes, sin subir nada a GCS.

  Para sanar los paquetes ya publicados con el bug (ZIP con versión vieja en `package.json`),
  basta con ejecutar **actualizar+enviar** desde el gestor interactivo: el pull aplica los
  cambios del ZIP y el push sube un nuevo ZIP con la versión correcta.

---
## 2026.5.19+1

### Added
- [Jose] `paquete/index.ts` — nuevo estado `ConsolaEstado.CONFLICTO` con color magenta
  brillante (morado). Al aplicar un update con conflictos de merge, la línea de progreso
  muestra ahora `[CONFLICTO]` en lugar de `[ERROR    ]`.
- [Jose] `paquete/index.ts` — padding uniforme de **9 caracteres** en todos los estados
  del objeto `STATUS` para que las cajas `[…]` tengan siempre el mismo ancho:
  `[         ]`, `[PENDING  ]`, `[OK       ]`, `[ERROR    ]`, `[CONFLICTO]`.
- [Jose] `cliente.ts` — `recompilarCliente(basedir, hash, reiniciar = true)`: nuevo
  tercer parámetro opcional. Cuando `reiniciar = false`, el CLI se recompila igualmente
  pero el proceso **no se relanza** aunque el binario haya cambiado. Evita el bucle
  infinito cuando se actualiza `@mr/cli` desde `mrpack framework`.
- [Jose] `gestor.ts` — `ejecutarAcciones`, `gestionar`, `actualizarTodo`, `enviarTodo` y
  `resetearTodo` reciben el parámetro `reiniciar = true` y lo propagan hasta
  `recompilarCliente`. El parámetro controla si se permite el reinicio automático del
  proceso tras recompilar el CLI.

### Changed
- [Jose] `gestor.ts` — `ejecutarAcciones`: los mensajes de conflicto/error que antes se
  imprimían con `console.log` directamente dentro del `Promise.all` (descolocando las
  líneas de progreso) se acumulan ahora en un array `avisos[]` y se imprimen todos juntos
  **al final**, una vez que han terminado todas las acciones en paralelo.
- [Jose] `modulos/framework.ts` — todas las llamadas a `actualizarTodo`, `resetearTodo`,
  `enviarTodo` y `gestionar` pasan `reiniciar = false`. Esto garantiza que al invocar
  cualquier variante de `yarn mrpack framework` el proceso **nunca** se reinicia
  automáticamente al actualizar `@mr/cli`, eliminando el bucle de reinicio sin fin cuando
  hay conflictos en la actualización del CLI.

---
## 2026.5.15+next

### Added
- [Jose] `README.md` — añadida referencia al sistema de parches de migración en la sección
  `update`: nota sobre `yarn workspace @mr/core-dev mrpack:patch:apply` y enlace a
  `@mr/core/dev/patches/README.md`.
- [Jose] `README.md` — añadidas dos filas a la tabla de referencia rápida:
  **"Aplicar parches de migración"** (`mrpack:patch:apply`) y
  **"Comprobar parches pendientes (CI)"** (`mrpack:patch`).

### Fixed
- [Jose] `paquete/directory.ts` — `addNuevos` sobreescribía **todos** los `PaqueteFile` del
  árbol (incluidos los ya cargados desde el `status.json` del ZIP) con objetos nuevos cuyo
  `hash` era `""` (DEFECTO). Esto provocaba que `recalcularHash` detectara siempre cambios
  en todos los archivos (`antiguo=""`) y actualizara la autoría de todos los `.ts` en cada
  `send`, aunque su contenido no hubiera variado. Corregido añadiendo la guarda
  `if (this.archivos[file] === undefined)` (ídem para directorios) para que solo se registren
  ficheros realmente nuevos en disco.
- [Jose] `paquete/index.ts` — `savePaquete()` se llamaba **antes** de `subirPaquete()`.
  Si el proceso se interrumpía entre ambas llamadas, `package.json` quedaba con la versión
  nueva pero el ZIP nunca llegaba a GCS; el siguiente `send` buscaba ese ZIP inexistente
  y reconstruía el estado desde cero (todos los hashes a `""`), perpetuando el ciclo de
  falsos cambios. Corregido reordenando para que `savePaquete()` se ejecute siempre
  **después** de `subirPaquete()` y `subirLatest()`.
- [Jose] `paquete/file.ts` — el bloque de autoría (`Editor / Fecha / Hash`) se incluía en
  el cálculo del hash del fichero, de modo que actualizar solo la fecha del comentario
  generaba un hash distinto y forzaba un `send` innecesario. Introducida la función
  `stripAutoria` (patrón `PATRON_AUTORIA`) que elimina el bloque antes de calcular el hash,
  garantizando que solo los cambios reales en el cuerpo del fichero generan una nueva versión.

### Added
- [Jose] `paquete/file.ts` — el bloque de autoría de los ficheros `.ts` incluye ahora el
  campo `* Versión: YYYY.MM.DD+N-autor` con el número de versión completo del paquete
  que se está publicando.
- [Jose] `paquete/file.ts` — el bloque de autoría incluye también el campo `* Anterior: X`
  con la versión que figuraba en `* Versión:` del bloque anterior (si existía), permitiendo
  trazar el historial de versiones directamente en el fichero.
- [Jose] `framework/gestor.ts` — los logs de `tmp/log/` pasan a formato Markdown
  (`.pull.md` y `.push.md`) e incluyen enlaces clickables a los ficheros afectados para abrirlos
  directamente desde el entorno.
- [Jose] `framework/gestor.ts` — añadido `tmp/log/index.md`, regenerado automáticamente
  al escribir cada log, con índice de logs de update/push y enlaces clickables.

---
## 2026.5.14+7

### Fixed
- [Jose] `ejecutarAcciones` — al resetear paquetes la consola creaba una línea nueva por
  cada paquete en lugar de reciclar la línea existente. Añadido `Paquete.setupConsolaParaUpdate`
  antes del `Promise.all` de resets, igual que ya hacían los bloques de instalación,
  actualización y envío.

### Changed
- [Jose] `init.ts` — `initYarnRC` reescrito usando `js-yaml` (`yamlLoad` / `yamlDump`)
  en lugar de manipulación manual de strings (split / indexOf / splice). La función ahora
  parsea el `.yarnrc.yml` a un objeto `IYarnRC` tipado, modifica los campos necesarios y
  serializa de vuelta con `sortKeys: true` y una línea en blanco entre cada clave de
  nivel raíz. Reducción de ~60 líneas a ~35.
- [Jose] `init.ts` — añadida interfaz `IYarnRC` con todos los campos del `.yarnrc.yml`.
- [Jose] `@mr/cli/package.json` — añadidas dependencias `js-yaml@^4.1.0` y
  `@types/js-yaml@^4.0.9`.

### Added
- [Jose] `initYarnRC` asegura ahora también los campos de seguridad
  `checksumBehavior: throw`, `enableStrictSsl: true` y `unsafeHttpWhitelist: []`
  junto con los ya existentes `enableHardenedMode: true` y `npmMinimalAgeGate: 1440`.

---
## 2026.5.14+5

### Fixed
- [Jose] `ejecutarAcciones` — mensajes duplicados al enviar: `enviarTodo` ya imprime
  `"Enviando N paquete(s)..."` antes de llamar a `ejecutarAcciones`, por lo que los
  mensajes `"Enviando frameworks seleccionados..."` y `"Actualizando y enviando
  frameworks seleccionados..."` dentro de `ejecutarAcciones` eran redundantes.
  Eliminados.

### Changed
- [Jose] `ejecutarAcciones` — despacho de acciones refactorizado: el antiguo
  `Map` + 6 pases `filter().map()` (O(6n)) sustituido por un único bucle `switch`
  (O(n)), eliminando creación de estructuras intermedias.
- [Jose] `ejecutarAcciones` — `getAutor()` se llama una sola vez antes de los bloques
  de envío en lugar de dos veces (una por bloque). La llamada solo se realiza si hay
  algún paquete que enviar.
- [Jose] `ejecutarAcciones` — eliminadas las llamadas redundantes a
  `.filter(i => i.instalado && i.versionLatest !== undefined)` en el bloque
  `aEnviarConUpdate`: `tieneEnviarConUpdate` garantiza ambas condiciones y
  `construirInfoPaquetes` establece `versionLatest` siempre que `tieneUpdate = true`.
  Asimismo, el filtro en `aInstalar` se simplifica a `.filter(i => i.instalado)`.
- [Jose] `GestorTabla` — `slots` pre-calculado en el constructor y almacenado como
  `readonly`. `renderAcciones` ya no reconstruye el array en cada frame, reduciendo
  allocaciones durante el renderizado de la tabla.

---
## 2026.5.14+4

### Changed
- [Jose] `framework/gestor.ts` — `GestorTabla` acepta `soloUpdate = false` como segundo
  parámetro del constructor. En modo `soloUpdate`:
  - `accionesDisponibles` devuelve únicamente `[Nada, Actualizar]` por paquete.
  - `renderAcciones` muestra solo los slots `nada` y `actualizar`; se ocultan los de
    `desinstalar`, `resetear` y `enviar`.
  - Los atajos `r` (resetear todos) y `e` (enviar todos) se deshabilitan.
  - El separador horizontal se recalcula con el ancho reducido.
- [Jose] `framework/gestor.ts` — `GestorTabla.run(autoConfirmMs?)`: nuevo parámetro
  opcional de auto-confirmación. Si se pasa (e.g. `5000`), se inicia un temporizador que
  resuelve la promesa con las acciones actuales al expirar. El temporizador se cancela
  al primer keypress y aparece debajo de la tabla como `"Auto-confirma en Ns — pulsa
  cualquier tecla para cancelar"`, actualizándose cada segundo.
- [Jose] `framework/gestor.ts` — `actualizarTodo` sustituye el `checkbox` de
  `@inquirer/prompts` por `new GestorTabla(infos, true).run(5000)`: ahora comparte
  exactamente la misma tabla que el gestor interactivo principal, en modo restringido
  con cuenta atrás de 5 s.
- [Jose] Import de `checkbox` eliminado de `gestor.ts`.

---
## 2026.5.14+3

### Changed
- [Jose] `framework/gestor.ts` — `actualizarTodo(basedir, forzar = false)`: añadido parámetro
  `forzar`. Con `forzar = false` (por defecto) muestra un selector de tipo checkbox con los
  paquetes que tienen update pendiente, todos preseleccionados; si no hay interacción en 5
  segundos se confirma automáticamente. Con `forzar = true` salta el selector y actualiza todo
  directamente (comportamiento anterior de `--update`).
- [Jose] `clases/devel.ts` — `pull(basedir, false)` sustituido por `actualizarTodo(basedir)`:
  reutiliza la misma implementación con selector interactivo y timeout de 5 s.
- [Jose] `clases/update.ts` — `actualizarTodo(basedir)` cambiado a
  `actualizarTodo(basedir, true)`: modo silencioso para `yarn mrpack update`.
- [Jose] `modulos/framework.ts` — `actualizarTodo(this.root)` cambiado a
  `actualizarTodo(this.root, true)`: modo silencioso para `yarn mrpack framework --update`.

### Removed
- [Jose] `framework/paquetes.ts` eliminado: `pull` y `cargarTodosLosPaquetes` quedan
  absorbidos por `actualizarTodo`. Ya no existe implementación duplicada del ciclo de vida
  de actualización de paquetes.
- [Jose] `framework/index.ts` — eliminado el re-export de `pull`.

---
## 2026.5.14+2

### Changed
- [Jose] `clases/update.ts` — sustituida la llamada `pull(basedir, true)` por
  `actualizarTodo(basedir)`: reutiliza el mismo código que `yarn mrpack framework --update`,
  ganando paralelización completa, logs en `tmp/log/` y detección `soloInstalados`.
  El comportamiento observable es idéntico (actualiza todos los frameworks instalados sin
  interacción), pero el flujo interno es compartido.

---
## 2026.5.14+1

### Added
- [Jose] `framework/gestor.ts` — `escribirLog(basedir, info, entradas, logsRaw)`: escribe el
  resultado de cada `applyUpdate` en `{basedir}/tmp/log/{nombre}.log`. El fichero incluye un
  encabezado con la fecha, la versión de origen y la versión destino, el listado de ficheros
  afectados con prefijo `[OK   ]` / `[Error]` y, si los hay, la salida capturada del proceso.
  Si el fichero ya existía se sobreescribe. En consola solo se muestra un aviso con la ruta al
  log cuando hay conflictos de merge.
- [Jose] `paquete/file.ts` — `IUpdateTracker` exportado: interfaz mutable
  `{hayConflictos: boolean; entradas: {archivo: string; estado: "ok" | "error"}[]}` que fluye
  por todo el árbol de ficheros durante `checkCambios` y acumula cada fichero afectado.
- [Jose] `framework/gestor.ts` — parámetro `soloInstalados` en `construirInfoPaquetes`:
  cuando es `true` (usado en `--update`, `--send` y `--reset`) escanea los directorios locales
  en lugar de listar GCS, evitando llamadas de red innecesarias cuando ya se sabe que solo
  interesan los paquetes instalados.

### Changed
- [Jose] `framework/gestor.ts` — `const enum Accion` sustituye al antiguo `type Accion`:
  valores PascalCase (`Nada`, `Instalar`, `Actualizar`, `Resetear`, `Desinstalar`, `Enviar`,
  `EnviarConUpdate`) con strings en minúsculas como valores. Mejora la consistencia y la
  exhaustividad en tiempo de compilación.
- [Jose] `framework/gestor.ts` — `ejecutarAcciones`: todas las fases (bootstrap de instalación,
  instalaciones+actualizaciones, resets, desinstalaciones, envíos directos y `enviarConUpdate`)
  se ejecutan en paralelo con `Promise.all`. La llamada a `interceptOutput` fue eliminada, lo que
  hace posible la paralelización total sin interferencias entre paquetes.
- [Jose] `framework/gestor.ts` — `aEnviar`: se llama a `Paquete.setupConsolaParaUpdate` antes
  del `Promise.all` de envíos directos, de modo que cada paquete recicla su propia línea en
  consola (igual que ya hacían instalar/actualizar).
- [Jose] `framework/paquetes.ts` — paso 5 de `pull` paralelizado: las actualizaciones de
  los paquetes seleccionados se aplican con `Promise.all` en lugar de secuencialmente.
- [Jose] `paquete/index.ts` — `applyUpdate` devuelve `{cambio, conflictos, entradas}` (antes
  solo `{cambio, conflictos}`). Las `entradas` provienen del `IUpdateTracker` tras el merge.
- [Jose] `paquete/root.ts` — `actualizarVersion` devuelve
  `{actualizado, conflicto, entradas}` propagando el tracker completo.
- [Jose] `paquete/file.ts` — `checkCambios` sin `console.log`; `Colors` import eliminado.
- [Jose] `paquete/directory.ts` — `console.log` eliminado de la eliminación de directorios;
  `Colors` import eliminado.
- [Jose] `modulos/auto-doc.ts` — bug corregido: importaba `IConfigEjecucion` de `clases/devel`
  (que tiene `compilar/ejecutar/forzar`) en lugar del tipo correcto del propio módulo.
  `IAutoDoc` ahora solo extiende `IModulo` con `env?: string`; el bloque `parseParams`
  protege contra `undefined` con la rama `else { mostrarAyuda() }`.
- [Jose] `modulos/init.ts` y `modulos/update.ts` — interfaces `IInitConfig`/`IInit` y
  `IUpdateConfig`/`IUpdate` simplificadas: eliminados bloques `options` vacíos con comentarios
  e interfaces implícitas sin miembros.
- [Jose] Regla de estilo añadida al workspace: usar siempre `Tipo[]` en lugar de `Array<Tipo>`.
  El uso incorrecto en `gestor.ts` (`Array<{key: Accion; ancho: number}>`) fue corregido.

### Removed
- [Jose] `modulos/upload.ts` eliminado: el comando `yarn mrpack upload` ya no existe.
  `yarn mrpack framework --send` cubre el mismo caso de uso con mejor comportamiento
  (paralelización, logs de conflictos, detección automática de update previo).
- [Jose] `framework/paquetes.ts` — `push()` y `reset()` eliminadas (código muerto):
  `enviarTodo` en `gestor.ts` ofrece la misma funcionalidad con implementación completa.
- [Jose] `framework/index.ts` — eliminado el re-export de `reset` (ya no existe en `paquetes.ts`).

---
## 2026.5.13+9

### Added
- [Jose] `mrpack framework --send` / `-s`: envía todos los paquetes con cambios locales sin
  interacción del usuario. Si un paquete tiene un update remoto pendiente, primero aplica el
  update (merge 3-way); si el merge no genera conflictos continúa con el envío; si genera
  conflictos omite el envío de ese paquete y continúa con los demás.
- [Jose] `framework/gestor.ts` — `enviarTodo(basedir)`: función exportada que construye el
  mapa de acciones (`enviar` / `enviarConUpdate` / `nada`) de forma automática y delega en
  `ejecutarAcciones`.

### Changed
- [Jose] `framework/gestor.ts` — `tieneEnviar` y `tieneEnviarConUpdate` son ahora `public static`
  para poder ser referenciadas desde `enviarTodo` sin duplicar la lógica de condición.
- [Jose] `modulos/framework.ts` — añadido flag `--send` (`-s`); la firma de `IFrameworkConfig`
  e `IFramework` se amplían correspondientemente; el texto de ayuda incluye la nueva opción.
- [Jose] `README.md` — sección `framework` actualizada con el nuevo flag `-s`/`--send`.

---
## 2026.5.13+8

### Added
- [Jose] `framework/gestor.ts` — nueva acción `"enviarConUpdate"`: proceso de dos pasos que
  primero aplica el update remoto pendiente y, si no se generan conflictos en el merge, envía
  los cambios locales automáticamente. Se muestra en **cyan** en la tabla interactiva con el
  texto `"actualizar+enviar"`.
- [Jose] `paquete/index.ts` — `_prebaked`: cache interna de
  `{status, hayCambios, versionBase}` que se rellena durante `checkCambiosLocales()` y se
  consume en `push()`, evitando una segunda descarga de GCS y un segundo escaneo del árbol de
  ficheros. Se invalida automáticamente tras un `applyUpdate`.
- [Jose] `paquete/index.ts` — `invalidarCacheVersion()`: limpia `_latestCache` para forzar una
  consulta fresca a GCS y poder detectar si otra persona ha publicado entre medias.
- [Jose] `paquete/root.ts` — `actualizarAutor(versionBase, autor)`: recalcula el campo `version`
  a partir de la versión base sin volver a escanear el árbol de ficheros.
- [Jose] `framework/gestor.ts` — verificación de versión remota antes de ejecutar: tras la
  selección del usuario y antes de aplicar las acciones, se consulta la versión remota actual de
  cada paquete marcado para envío. Si ha cambiado, se muestra un aviso `⚠` y se recarga la tabla
  para que el usuario vuelva a elegir.

### Changed
- [Jose] `utiles/merge.ts` — `merge3` devuelve `{text: string; conflict: boolean}` en lugar
  de `string`, permitiendo propagar hacia arriba si la mezcla generó secciones en conflicto.
- [Jose] `paquete/file.ts` — `mezclar()` devuelve `{hash, conflict}`. `checkCambios()` acepta
  un `tracker?: {hayConflictos: boolean}` opcional que se rellena si la mezcla 3-way genera
  conflictos.
- [Jose] `paquete/directory.ts` — `checkCambiosEjecutar` y `checkCambios` aceptan el mismo
  `tracker?` y lo propagan en todas las llamadas recursivas y a `file.checkCambios`.
- [Jose] `paquete/root.ts` — `actualizarVersion` devuelve `{actualizado: boolean; conflicto: boolean}`
  en lugar de `boolean`. Crea internamente el `tracker` y lo pasa a `checkCambios`.
- [Jose] `paquete/index.ts` — `applyUpdate` devuelve `{cambio: boolean; conflictos: boolean}`.
  Si `conflictos === true` el gestor no realiza el push posterior.
- [Jose] `framework/gestor.ts` — `defaultAccion` simplificada: la acción por defecto es
  `"actualizar"` si hay update remoto, o `"nada"` en cualquier otro caso. Las acciones
  `"enviar"` y `"enviarConUpdate"` ya no se preseleccionan automáticamente; el usuario debe
  elegirlas explícitamente (tecla `e` o navegación con `←`/`→`).
- [Jose] `framework/gestor.ts` — `tieneEnviarConUpdate()` sustituye a `enviarBloqueado()`;
  la celda `"enviar"` roja ya no existe: cuando hay update pendiente + cambios locales la acción
  disponible es directamente `"enviarConUpdate"`. La tecla `e` selecciona `"enviarConUpdate"` o
  `"enviar"` según corresponda.
- [Jose] `framework/gestor.ts` — `construirInfoPaquetes` acepta el parámetro opcional
  `checkCambios = true`; los modos no interactivos (`actualizarTodo`, `resetearTodo`) lo pasan
  a `false` para saltarse el costoso ciclo de normalización de hash.
- [Jose] `framework/paquetes.ts` — adaptado para usar `(await paquete.applyUpdate(latest)).cambio`.

---
## 2026.5.13+7

### Added
- [Jose] `mrpack framework --update` / `-u`: actualiza todos los paquetes con versión remota
  disponible sin mostrar el gestor interactivo. Equivale a abrir el gestor con `actualizar`
  preseleccionado en todos los paquetes aplicables y confirmar con Intro.
- [Jose] `mrpack framework --reset` / `-r`: resetea todos los paquetes instalados a su versión
  publicada sin interacción. Equivale a abrir el gestor con `resetear` preseleccionado en todos.
- [Jose] `framework/gestor.ts` — `actualizarTodo(basedir)` y `resetearTodo(basedir)`:
  funciones exportadas que construyen el mapa de acciones automáticamente y delegan en la
  nueva función interna `ejecutarAcciones`.

### Changed
- [Jose] `framework/gestor.ts` — la lógica de ejecución de `gestionar` extraída a la función
  privada `ejecutarAcciones(basedir, infos, accionesArr)` para evitar duplicación entre el
  flujo interactivo y los nuevos modos no interactivos.
- [Jose] `modulos/framework.ts` — añadidos flags `--update` (`-u`) y `--reset` (`-r`);
  la firma de `IFrameworkConfig` e `IFramework` se amplían correspondientemente.
- [Jose] `README.md` — sección `framework` actualizada con la tabla de opciones y ejemplos.

---
## 2026.5.13+6

### Added
- [Jose] `paquete/index.ts` — `checkCambiosLocales()`: detecta si el árbol de ficheros local
  difiere del último estado publicado en GCS, replicando exactamente el proceso de `push`
  (normaliza `package.json` a `"0.0.0+0"`, llama a `crearVersion` y restaura el fichero en `finally`).
- [Jose] `paquete/index.ts` — `calcularHashCambiado(status, autor)`: método privado compartido
  por `push` y `checkCambiosLocales` para evitar duplicar la lógica de normalización del hash.

### Changed
- [Jose] `paquete/index.ts` — `getLatest()` cachea su `Promise` en `_latestCache` para evitar
  una segunda petición a GCS cuando se encadena `checkUpdate()` + `getVersionRemota()`.
- [Jose] `paquete/index.ts` — `anticuado` y `adelantado` refactorizados usando el nuevo método
  estático privado `compararVersiones`, eliminando la duplicación de la lógica de parsing semver.
- [Jose] `paquete/index.ts` — `loadAll` paraleliza el escaneo de los tres directorios
  (`@mr/core`, `@mr/user`, `framework`) con `Promise.all`.
- [Jose] `framework/gestor.ts` — `tieneEnviar` y `enviarBloqueado` requieren `tieneCambiosLocales === true`
  (antes podían activarse sin cambios locales reales).
- [Jose] `framework/gestor.ts` — `construirInfoPaquetes` ejecuta `checkUpdate` y `checkCambiosLocales`
  en paralelo por paquete con `Promise.all`.
- [Jose] `init.ts` — las dos llamadas a `resolverDepsTransitivas` (para `dependencies` y
  `optionalDependencies`) ahora corren en paralelo con `Promise.all`.
- [Jose] `@mr/core/network/server/http/conexion.ts` — `post` acepta también `unknown[]`
  además de `NodeJS.Dict<unknown>`.

### Refactored
- [Jose] `clases/framework.ts` dividido en cuatro submódulos bajo `clases/framework/`:
  - `cliente.ts` — `add`, `remove`, `getClienteHash`, `getClienteMD5`, `checkCliente`,
    `recompilarCliente`, `getAutor`, `pullPackage`.
  - `paquetes.ts` — `cargarTodosLosPaquetes` (privada), `pull`, `push`, `reset`.
  - `gestor.ts` — `listarNombresGCS`, `IPaqueteGestion`, `GestorTabla`,
    `construirInfoPaquetes`, `gestionar`.
  - `index.ts` — barrel que re-exporta todo lo anterior.
  - El fichero `clases/framework.ts` ha sido eliminado; la resolución de módulos de
    TypeScript/Node resuelve `from "./framework"` automáticamente a `framework/index.ts`.
  - Todos los consumidores existentes (`devel.ts`, `update.ts`, `init.ts`,
    `modulos/upload.ts`, `modulos/framework.ts`) funcionan sin cambios.

### Fixed
- [Jose] `framework` — la opción `enviar` aparecía en paquetes sin cambios locales reales.
  La causa era que el hash se comparaba con el `package.json` real (`2026.x.y+N`), pero el
  hash stored en GCS fue calculado con la versión normalizada `"0.0.0+0"`. Corregido con
  `calcularHashCambiado`, que replica exactamente el proceso de `push`.

---
## 2026.5.13+5

### Added
- [Jose] `framework.ts` — columna extra `enviar` en la tabla interactiva de `gestionar()`:
  - La columna solo aparece si al menos un paquete instalado tiene su versión local diferente
    a la remota (local ≠ latest), indicando cambios pendientes de publicar.
  - Por fila: si el paquete tiene cambios y no hay update pendiente → checkbox `○`/`◉` en verde
    seleccionable con la tecla `e`. Si el paquete tiene un update remoto pendiente (`tieneUpdate`)
    → celda `⊘ enviar` en rojo, visible pero no seleccionable.
  - Al confirmar con Intro, los paquetes marcados se envían secuencialmente con `paquete.push(autor)`
    (el autor se obtiene de `git config user.name`).
  - Atajo `e`: alterna el estado de envío del paquete activo (solo si está disponible).
  - El ancho del separador se recalcula incluyendo la nueva columna.

---
## 2026.5.13+4

### Changed
- [Jose] `init.ts` — `resolverDepsTransitivas` acepta nuevo parámetro `campo`
  (`"dependencies"` | `"optionalDependencies"`, por defecto `"dependencies"`), permitiendo
  reutilizar el mismo recorrido recursivo para ambos tipos de dependencias.
- [Jose] `init.ts` — `initWorkspace` propaga también las `optionalDependencies` de los
  paquetes `@mr/*` declarados como devDependencies:
  - Se lanza `resolverDepsTransitivas(..., "optionalDependencies")` con un `Set` de visitados
    independiente del de `dependencies` y se fusiona el resultado en `paquete.optionalDependencies`.
  - Tras fusionar las `dependencies` transitivas en `paquete.dependencies`, se elimina
    `bufferutil` de `paquete.dependencies` si existía (ya sea por propagación transitiva o
    por declaración previa en el propio `package.json`), ya que este módulo nativo solo debe
    aparecer en `optionalDependencies`.
  - Si `paquete.optionalDependencies` queda vacío tras la fusión, se elimina el campo.

---
## 2026.5.13+3

### Added
- [Jose] `framework.ts` — gestor interactivo `gestionar(basedir)` con tabla ANSI completa:
  - Columnas: `tipo` | `nombre` | `instalada` | `disponible` | radio buttons de acción.
  - Paquetes incluidos: `@mr/cli`, `@mr/core/*` (desde GCS), `@mr/user/*` (desde GCS) y
    `framework/services-*` (solo los ya instalados localmente, tipo `legacy`).
  - Radio buttons con slots fijos en orden `nada | actualizar/instalar | desinstalar | resetear`.
    Si ningún paquete tiene la opción `actualizar/instalar`, la columna se oculta completamente.
    Si la opción no aplica a un paquete concreto, se reserva el hueco para mantener la alineación.
  - Acciones disponibles según estado del paquete:
    - `nada`: siempre disponible; es la acción por defecto salvo en paquetes instalados con update.
    - `instalar` / `actualizar`: solo si hay versión remota más reciente disponible.
    - `desinstalar`: solo si está instalado y no es `@mr/cli` ni `legacy`.
    - `resetear`: solo si está instalado.
  - Atajos de teclado globales: `n` → nada en todos, `a` → actualizar en todos, `r` → resetear en todos.
  - Línea de ayuda separada con `│` entre grupos de atajos.
  - Anchos de columna `tipo` y `nombre` calculados dinámicamente (mínimo `"tipo".length` / `"nombre".length`).
- [Jose] `framework.ts` — `listarNombresGCS(subdir, bucket?)`: lista prefijos GCS bajo `@mr/core/` y `@mr/user/`.
- [Jose] `framework.ts` — `construirInfoPaquetes(basedir, bucket?)`: carga en paralelo el estado
  completo de todos los paquetes (versión local + versión remota vía `checkUpdate` / `getVersionRemota`).
- [Jose] `paquete/index.ts` — `Paquete.buildVirtual(npmName, tipo, bucket?)`: crea una instancia sin
  `package.json` local, útil para paquetes no instalados.
- [Jose] `paquete/index.ts` — `Paquete.formatVersion(v)`: expone `maquetarVersion` de forma estática.
- [Jose] `paquete/index.ts` — `get versionPublica()`: getter público para `this.version`.
- [Jose] `paquete/index.ts` — `getVersionRemota()`: llama a `getLatest()` de forma pública.

### Changed
- [Jose] `mrpack/modulos/framework.ts` — eliminadas todas las opciones (`--add`, `--list`, `--remove`,
  `--repository`, `--reset`, `--update`); el comando sin argumentos abre directamente `gestionar()`.
- [Jose] `README.md` — sección `framework` reescrita reflejando el nuevo gestor interactivo:
  tabla de columnas, acciones, navegación, tipos de paquete y atajos de teclado.

---
## 2026.5.13+2

### Added
- [Jose] `framework.ts` — `add(basedir, frameworks[])` implementado:
  - Detecta el tipo de paquete a partir del nombre: `@mr/core/<name>` → `core`,
    `@mr/user/<name>` → `user`, resto → `legacy`.
  - Crea el directorio y el `package.json` mínimo si no existen y llama a `pullPackage`
    para descargar la última versión desde el bucket GCS.
- [Jose] `init.ts` — resolución de dependencias transitivas durante el `init`:
  - Nueva función `resolverDepsTransitivas(root, devDeps, visitados)`: recorre de forma
    recursiva todos los `devDependencies` con nombre `@mr/*`, lee su `package.json`,
    acumula sus `dependencies` de producción y repite el proceso para sus propias `@mr/*`
    devDependencies. Usa un `Set` de visitados para evitar referencias circulares.
  - Nueva función `mrNombreADir(root, nombre)`: traduce `@mr/core-X` → `@mr/core/X`,
    `@mr/user-X` → `@mr/user/X`, `@mr/cli` → `@mr/cli`.
  - Nueva función `versionMasReciente(a, b)`: compara dos rangos semver y devuelve el
    más reciente; si alguno es `*`, prefiere el otro.
  - En `initWorkspace`, tras `checkDependencies`, se llaman las funciones anteriores y se
    fusionan las dependencias propagadas en `paquete.dependencies`.

### Changed
- [Jose] `paquete/index.ts` — `PaqueteTipo.client` renombrado a `PaqueteTipo.user`; el
  repo de los paquetes de tipo `user` pasa de `@mr/client/<name>` a `@mr/user/<name>`.
- [Jose] `paquete/index.ts` — `loadAll` incluye ahora `@mr/user/*` además de `@mr/core/*`.
- [Jose] `framework.ts` — `cargarTodosLosPaquetes` incluye ahora `@mr/user/*`.
- [Jose] `framework.ts` — `list()` case `client` renombrado a `user`; subdir `@mr/client` → `@mr/user`.
- [Jose] `init.ts` — el bootstrap de paquetes en `checkCliente` usa `add()` en lugar de
  los tres bloques manuales de `mkdir` + `safeWrite` + `pullPackage`.
- [Jose] `rspack.config.ts` — si `package.json` devuelve `null`, lanza un `Error` explícito
  con la ruta afectada (antes se propagaba con `?.`).

---
## 2026.5.13+1

### Added
- [Jose] Creado `README.md` del paquete con documentación completa del ejecutable `mrpack`:
  tabla de módulos, opciones por módulo, ejemplos de uso y referencia rápida.
- [Jose] `paquete/index.ts` — nuevos métodos públicos sobre `Paquete`:
  - `checkUpdate()` — comprueba si existe una versión remota más reciente sin descargar el ZIP.
  - `applyUpdate(latest)` — descarga y aplica la actualización con captura de salida (ver Changed).
  - `etiquetaUpdate(latest, padding?)` — genera la etiqueta formateada para el selector de actualización.
  - `setupConsolaParaUpdate(paquetes[])` — configura el display de cursor dinámico para N paquetes.

### Changed
- [Jose] `framework.ts` — rediseño completo del flujo `pull`:
  - **Fase 1 (paralela):** comprueba actualizaciones de todos los paquetes (`@mr/cli` + `@mr/core/*` +
    `framework/*`) simultáneamente, solo descargando `stable.txt` por paquete.
  - **Fase 2 (selector):** muestra un `checkbox` interactivo con los paquetes pendientes; el nombre
    completo con versiones (`name`) se muestra durante la selección, y solo el nombre del paquete
    (`short`) aparece en el resumen tras confirmar. Temporizador de 5 s cancelable al primer keypress.
  - **Fase 3 (secuencial):** aplica actualizaciones una a una, capturando la salida de cada paquete
    en `paquete.logs` para no romper el display de progreso.
  - **Fase 4 (logs):** muestra un resumen `Registros del proceso de actualización` por paquete con
    los mensajes capturados, si los hay.
  - Con `--forzar` se omite el selector y se actualizan todos los paquetes pendientes directamente.
  - Eliminadas las funciones `pullPackage` (helpers internas de la fase de comprobación),
    `pullCore` y `pullLegacy`; `pullPackage` se mantiene exportada para uso de `mrpack init`.
- [Jose] `paquete/index.ts` — `applyUpdate` intercepta `process.stdout.write` y
  `process.stderr.write` durante su ejecución: solo deja pasar la salida originada en `consola()`
  (marcada con el flag `consolaEscribiendo`); el resto se acumula en `this.logs`.
- [Jose] `rspack.config.mjs` — añadidos `typescript` y `ts-checker-rspack-plugin` a los externals
  para evitar que rspack los empaquete y eliminar el warning *"Critical dependency: the request of
  a dependency is an expression"* de `typescript.js`.

---
## 2026.5.6+1

### Added
- [Jose] Documentación JSDoc completa del directorio `manifest/`: interfaces `IManifest`, `Manifest`, `IManifestDeployment`, `ManifestDeployment`, `IManifestDeploymentBuild`, `ManifestDeploymentBuild`, `IManifestDeploymentRun` y `ManifestDeploymentRun`
- [Jose] Creado `manifest/README.md` con esquema JSON, tablas de propiedades, valores por defecto y variables de entorno

### Changed
- [Jose] Refactorizadas las clases solo-static a funciones de módulo para mayor claridad y eficiencia:
  - `yarn.ts`: `class Yarn` → `export function install` / `export function update`
  - `framework.ts`: `class Framework` → funciones exportadas individuales
  - `update.ts`: `class Update` → `export async function init`
  - `devel.ts`: `class Devel` → `export function run`
  - `auto-doc.ts`: `class AutoDoc` → `export function run`
  - `comando.ts`: `class Comando` → `export async function Comando`
  - `log.ts`: `class Log` → `export const Log` (objeto exportado)
- [Jose] Eliminados todos los dynamic imports (`await import(...)`) de `src/mrpack`, reemplazados por imports estáticos
- [Jose] Sustituidos todos los `import * as Namespace` por imports nombrados individuales
- [Jose] `MODULOS` en `mrpack.ts` declarado `as const` para garantizar exhaustividad en tiempo de compilación

### Fixed
- [Jose] El destruturing del `Promise.all` de 3 elementos en `devel.ts` capturaba solo 2 variables; corregido a `[core, framework, packages]`
- [Jose] Servicio con error nunca se reiniciaba: `this.ejecucion` no se reseteaba antes del `setTimeout`; corregido
- [Jose] `webpackChunkName` incorrecto en `modulos/deploy.ts`: `"mrpack/devel"` → `"mrpack/deploy"`
- [Jose] Ayuda duplicada en `auto-doc.ts`: llamada doble a `mostrarAyuda()`
- [Jose] Doble asignación `i18n = i18n = new I18N(...)` en `devel.ts`
- [Jose] Texto de descripción erróneo en `modulos/framework.ts` mostraba `deploy` en lugar de `framework`
- [Jose] Watcher de `config.workspaces.json` en `devel.ts` sin `.catch()`
- [Jose] Proceso hijo en `comando.ts` sin handler `"error"` en el evento del proceso
- [Jose] `if (devel.enabled)` ignoraba `false` explícito en `root/deploy/build.ts`, `root/deploy/run.ts` y `workspace/development.ts`; corregido a `!== undefined`
- [Jose] `root/deploy/run.ts` comprobaba `enabled` dos veces; segunda comprobación corregida a `latest`

### Removed
- [Jose] Eliminado fichero huérfano `clases/service.ts` con interfaces duplicadas
- [Jose] Eliminado bloque Dockerfile PHP duplicado en `workspace/compilar.ts`
- [Jose] Eliminados bloques de código comentado obsoleto en `devel.ts`
- [Jose] Eliminada rama `default` inalcanzable en `mrpack.ts`

---
## 2026.1.7+1
- [Juan Carlos] Soporte a la versión 16 de NextJS.

---
## 2025.9.24+1

### Changed
- [Jose] Soporte multiarquitectura amd64/arm64 para Docker.

---
## 2025.7.28+1

### Updated
- [Juan Carlos] Se añade el patrón `**/coverage/**` al archivo `.gitignore` para evitar que se suba el directorio de cobertura de tests.

---
## 2025.7.23+1

### Updated
- [Jose] En el manifiesto de workspace, cuando se definen los buckets de storage en los que desplegar el código ahora se distingue entre producción y test (por defecto el mismo bucket)

---
## 2025.7.21+1

### Updated
- [Jose] MRPack y MRLang ahora se compilan utilizando RSPack en lugar de Webpack lo que reduce el tiempo de compilación

---
## 2025.5.21+1

### Updated
- [Jose] Update de librerías:
    - [@types/node](https://www.npmjs.com/package/@types/node) 22.15.21
    - [webpack](https://www.npmjs.com/package/webpack) 5.99.9

---
## 2025.5.13+1

### Updated
- [Juan Carlos] Update de librerías:
    - [@types/node](https://www.npmjs.com/package/@types/node) 22.15.17
    - [sass](https://www.npmjs.com/package/sass) 1.88.0
    - [webpack](https://www.npmjs.com/package/webpack) 5.99.8

---
## 2025.5.8+1

### Updated
- [Juan Carlos] Update de librerías:
  - [mysql2](https://www.npmjs.com/package/mysql2) 3.14.1
  - [@types/node](https://www.npmjs.com/package/@types/node) 22.15.16


---
## 2025.3.24+1

### Fixed
- [Jose] Se ha eliminado el contenido de `assets`, `output` y `.next` de los archivos supervisados por watch
- [Jose] Se ha silenciado los warnings cuando se ejecuta en producción/test

### Updated
- [Jose] Update de librerías:
    - [@inquirer/prompts](https://www.npmjs.com/package/@inquirer/prompts) 7.4.0
    - [@tsconfig/node22](https://www.npmjs.com/package/@tsconfig/node22) 22.0.1
    - [@types/node](https://www.npmjs.com/package/@types/node) 22.13.13
    - [mysql2](https://www.npmjs.com/package/mysql2) 3.14.0
    - [sass](https://www.npmjs.com/package/sass) 1.86.0

---
## 2025.3.14+1

### Added
- [Juan Carlos] Se añade soporte a workspaces tipo `scripts` para compilar y ejecutar en desarrollo.

---
## 2025.3.13+1

### Fixed
- [Jose] Se ha corregido una reescritura innecesaria del mrpack.json en cada inicio de compilación
- [Jose] Se ha ignorado los directorios de output, files, assets y .next del filewatcher

---
## 2025.3.12+1

### Changed
- [Jose] Update de librerías:
    - [webpack-manifest-plugin](https://www.npmjs.com/package/webpack-manifest-plugin) 5.0.1
- [Jose] Se ha revisado el archivo `.mr-ignore` dentro de `@mr/cli/bin`
- [Jose] Se ha desactivado la subida descomprimida a los repositorios antiguos

### Fixed
- [Jose] Cuando se añaden credenciales durante la compilación, se crea la ruta del destino por si se encontrara fuera
  del directorio por defecto

---
## 2025.3.10+1

### Changed
- [Jose] Update de librerías:
    - [@inquirer/prompts](https://www.npmjs.com/package/@inquirer/prompts) 7.3.3
    - [@types/node](https://www.npmjs.com/package/@types/node) 22.13.10

---
## 2025.3.7+1

### Changed
[Jose] Limpieza de propiedades vacías en el `package.json` raiz

---
## 2025.3.6+1

### Changed
- [Juan Carlos] Update de librerías:
    - [mysql2](https://www.npmjs.com/package/mysql2) 3.13.0
      [Jose] Añadido soporte a cluster multicliente durante el despliegue (para mrpress)

---
## 2025.3.5+1

### Changed
- [Jose] Se ha añadido la opción `defaultLogsBucketBehavior` a la configuración de despliegue
- [Jose] Se ha simplificado la configuración de despliegue
- [Jose] Si no se encuentra información de kustomización, se ignora el workspace en lugar de generar un error

---
## 2025.2.28+1

### Changed
- [Jose] Update de librerías:
    - [terser-webpack-plugin](https://www.npmjs.com/package/terser-webpack-plugin) 5.3.12

---
## 2025.2.27+1

### Changed
- [Jose] Refactorizada la propiedad deploy.kustomize de mrpack.json para soportar próximos cambios

---
## 2025.2.26+1

### Updated
- [Jose] Añadidas dependencias:
    - [dotenv](https://www.npmjs.com/package/dotenv) 16.4.7

### Changed
- [Jose] Se ha refactorizado los scripts de despliegue
    - Ahora se puede compilar y no desplegar, desplegar sin compilar, forzar una nueva versión de despliegue y
      actualizar el despliegue a la versión más reciente

---
## 2025.2.24+1

### Updated
- [Juan Carlos] Update de librerías:
    - [@google-cloud/storage](https://www.npmjs.com/package/@google-cloud/storage) 7.15.2
    - [sass](https://www.npmjs.com/package/sass) 1.85.0
    - [sass-loader](https://www.npmjs.com/package/sass-loader) 16.0.5
    - [webpack](https://www.npmjs.com/package/webpack) 5.98.0

---
## 2025.3.5+1

### Changed
- [Jose] Se ha añadido la opción `defaultLogsBucketBehavior` a la configuración de despliegue

---
## 2025.2.28+1

### Changed
- [Jose] Update de librerías:
    - [terser-webpack-plugin](https://www.npmjs.com/package/terser-webpack-plugin) 5.3.12

---
## 2025.2.27+1

### Changed
- [Jose] Refactorizada la propiedad deploy.kustomize de mrpack.json para soportar próximos cambios

---
## 2025.2.26+1

### Updated
- [Jose] Añadidas dependencias:
    - [dotenv](https://www.npmjs.com/package/dotenv) 16.4.7

### Changed
- [Jose] Se ha refactorizado los scripts de despliegue
    - Ahora se puede compilar y no desplegar, desplegar sin compilar, forzar una nueva versión de despliegue y
      actualizar el despliegue a la versión más reciente

---
## 2025.2.24+1

### Updated
- [Juan Carlos] Update de librerías:
    - [@google-cloud/storage](https://www.npmjs.com/package/@google-cloud/storage) 7.15.2
    - [sass](https://www.npmjs.com/package/sass) 1.85.0
    - [sass-loader](https://www.npmjs.com/package/sass-loader) 16.0.5
    - [webpack](https://www.npmjs.com/package/webpack) 5.98.0

---
## 2025.2.4+1

### Added
- [Jose] Se ha añadido manifiesto raiz de proyecto, orientado a configurar la construcción y despliegue del proyecto para producción/test de cara a la herramienta ci/cd

### Changed
- [Jose] Se ha limpiado las variables del proceso de despliegue
- [Jose] Se ha eliminado la necesidad de (des)autorizar antes de desplegar

---
## 2025.1.31+1

### Changed
- [Jose] Refactorizado el directorio `@mr/cli/manifest` a `@mr/cli/manifest/workspace` para dejar espacio a otros tipos de manifest
  - Se mantiene el la importación desde `@mr/cli/manifest` ya que solo será interesante exportar el manifiesto de workspaces

---
## 2025.1.30+1

### Changed
- [Jose] Se ha cambiado la estructura de la configuración de los workspaces, ahora en lugar de definirse dentro del archivo package.json se definen dentro del archivo mrpack.json ubicado en la raiz de cada workspace
  - Se puede obtener la referencia de la estructura de los archivos `mrpack.json` en [manifest/workspace/index.md](manifest/workspace/index.md)

---
## 2025.1.24+1

### Changed
- [Jose] Añadida estructura de nuevo archivo de manifiesto para los workspaces
- [Jose] Se ha cambiado las dependencias de mrpack para hacer la antigua interfaz Legacy
- [Jose] Se exporta la interfaz y clases para el nuevo manifiesto para poder leer el manifiesto desde los workspaces

---
## 2025.1.20+1

### Changed
- [Jose] Se ha separado los workspaces de `servicios` de los workspaces de `cronjobs`, ahora cada uno puede estar en su respectivo directorio
  - Por el momento pueden convivir mezclados tanto en el directorio `services` como en el directorio `cronjobs`

### Breaking Changes
- [Jose] El argumento pasado al Dockerfile `ws` se ha cambiado a `WS` (en mayúsculas). Si se ha creado un custom Dockerfile entonces hay que modificarlo en consecuencia

---
## 2025.1.16+5

### Updated
- [Juan Carlos] Update de librerías:
  - [chokidar](https://www.npmjs.com/package/chokidar) 4.0.3

---
## 2025.1.9+1

### Updated
- [Jose] Update de librerías:
    - [@google-cloud/storag](https://www.npmjs.com/package/@google-cloud/storag) 7.15.0
    - [@inquirer/prompts](https://www.npmjs.com/package/@inquirer/prompts) 7.2.1
    - [webpack-cli](https://www.npmjs.com/package/webpack-cli) 6.0.1
---
## 2024.12.16+1

### Updated
- [Jose] Update de librerías:
    - [@types/node](https://www.npmjs.com/package/@types/node) 22.10.2
    - [sass](https://www.npmjs.com/package/sass) 1.83.0

---
## 2024.12.10+1

### Updated
- [Jose] Update de librerías:
    - [@inquirer/prompts](https://www.npmjs.com/package/@inquirer/prompts) 7.2.0
    - [webpack](https://www.npmjs.com/package/webpack) 5.97.1

---
## 2024.12.4+1

### Changed
- [Jose] El archivo tsconfig.json ya no depende de services-comun
- [Jose] Añadida librería:
    - [@tsconfig/node22](https://www.npmjs.com/package/@tsconfig/node22) 22.0.0
- [Jose] Los binarios del `cli` ahora también se comparten cuando se sube una nueva versión
- [Jose] Se ha añadido la posibilidad de marcar ficheros/directorios como binarios para que no se mezclen sino que se sustituyan

### Updated
- [Jose] Update de librerías:
    - [sass](https://www.npmjs.com/package/sass) 1.82.0
    - [sass-loader](https://www.npmjs.com/package/sass-loader) 16.0.4

---
## 2024.12.3+1

### Updated
- [Jose] Update de librerías:
    - [sass](https://www.npmjs.com/package/sass) 1.81.1
    - [webpack](https://www.npmjs.com/package/webpack) 5.97.0

---
## 2024.11.28+1

### Updated
- [Jose] Update de librerías:
    - [@types/node](https://www.npmjs.com/package/@types/node) 22.10.1

---
## 2024.11.26+3

### Changed
- [Jose] Ahora se autoselecciona la versión LTS de node al abrir la consola

---
## 2024.11.26+1

### Updated
- [Jose] Update de librerías:
    - [@types/node](https://www.npmjs.com/package/@types/node) 22.10.0

---
## 2024.11.25+1

### Updated
- [Jose] Update de librerías:
    - [@types/node](https://www.npmjs.com/package/@types/node) 22.9.3
    - [typescript](https://www.npmjs.com/package/sass) 5.7.2

---
## 2024.11.18+1

### Changed
- [Jose] Se ha modificado los scripts internos del Cli
  - El script de actualización ya no da error

---
## 2024.11.15+1

### Changed
- [Jose] Revisado el loader de las herramientas para que detecte errores en el ejecutable y fuerce la recompilación

### Fixed
- [Jose] Fijada la librería [@elastic/elasticsearch](https://www.npmjs.com/package/@elastic/elasticsearch) a la versión `8.15.2` dado que la versión nueva `8.16.0` da errores de tipado

### Updated
- [Jose] Update de librerías:
    - [sass](https://www.npmjs.com/package/sass) 1.81.0

---
## 2024.11.14+1

### Changed
- [Jose] Correcciones visuales

---
## 2024.11.13+27

### Changed
- [Jose] Mejoras visuales del Cli

---
## 2024.11.13+26

### Fixed
- [Jose] Se han corregido muchos errores a la hora de actualizar el packaje.json del propio Cli

---
## 2024.11.13+1

### Updated
- [Jose] Update de librerías:
  - [sass](https://www.npmjs.com/package/sass) 1.80.7

---
## 2024.11.12+6

### Added
- [Jose] Añadida opción para listar frameworks
  ```bash
    yarn mrpack framework --list=<client|core|legacy> [--repository={bucket}]
  ```

---
## 2024.11.12+1

### Fixed
- [Jose] Ya se puede resetear el Cli
  - Cuando se resetea el Cli se comprueba si la versión compilada se corresponde con el código fuente actual y se reinicia el reseteo en caso de tener una versión nueva, así se hará el reseteo con una versión compilada actualizada
- [Jose] Cuando se actualiza el Cli, solo se reinicia el proceso si la nueva versión compilada ha cambiado respecto a la versión compilada anterior
- [Jose] Ya se envían, actualizan y resetean todos los FW con el código nuevo

---
## 2024.11.11+6

### Fixed
- [Jose] Corregida la detección de versión anterior para incrementar la versión

---
## 2024.11.11+5

### Fixed
- [Jose] Ahora se comprueba que el cli está compilado con el código actual evitando que el código se quede anticuado al actualizar el código por el commit de otra persona en git
- [Jose] Se ha añadido soporte varios formatos de frameworks (root, core, client y legacy)

---
## 2024.11.11+4

### Fixed
- [Juan Carlos] Corregido error al generar traducciones. Cuando no existía el idioma, en lugar de coger las traducciones del padre, se estaban cogiendo las "defecto".

---
## 2024.11.11+1

### Added
- [Jose] Se ha implementado la corrección de errores de GIT relacionados con cambios entre mayúsculas y minúsculas

---
## 2024.11.7+1

### Changed
- [Jose] Se ha reimplementado el PULL y PUSH del Cli:
  - Ahora se puede indicar el bucket al que sincronizar
  - Ahora en el bucket se almacenan copias versionadas en formato zip
  - Ahora al hacer un PULL se descarga la última versión del bucket además de la versión actual sin modificar para verificar los cambios a la hora de hacer el merge
  - Ahora se puede hacer PUSH y PULL en Windows (Beta), de momento solo para el caso del Cli
  - Ya no se utiliza el comando gsutil para interactuar con el almacén de Google Cloud
  - De momento se mantiene el PUSH antiguo para el cli, para que los proyectos puedan actualizarse al nuevo Cli
  - Se ha desactivado la opción de Reset para el caso del Cli
  - Se ha desactivado las opciones de Add y Remove para añadir y eliminar frameworks
  - Las releases ahora incluyen el nombre de git de quien la sube
  - Eliminada la necesidad de mantener en el repositorio el archivo status.json
  - Cuando se compila el proyecto, ahora se da la opción de no actualizar el Cli si hay una nueva versión
  - Se cambia `node:fs.watch` por `chokidar.watch` ya que mejora el rendimiento
  - Se ha renombrado el script para regenerar el Cli, para diferenciarlo del compilador de los proyectos

---
## 2024.10.30+1

### Fixed
- [Jose] Corregida la detección erronea de cambios en i18n que regeneraba las traducciones sin parar

---
## 2024.10.29+1

### Added
- [Jose] Añadida documentación de opciones de `mrpack` en el archivo [`scripts.md`](./scripts.md)
- [Jose] Añadida opción para resetear los frameworks a la versión publicada (descarta los cambios locales)
  ```bash
    yarn mrpack framework --reset
  ```

### Changed
- [Jose] Forzado el tipado de `node` a la versión `^22`

### Deleted
- [Jose] Eliminado el atajo `Doctor` que no se utilizaba
    - Se sigue pudiendo invocar con el comando `yarn run doctor`

### Fixed
- [Jose] Corregido error que hacía los nuevos archivos se interpretaran como directorios por lo que daban error al descargar

### Updated
- [Jose] Update de librerías:
    - [@types/node](https://www.npmjs.com/package/@types/node) 22.8.2

---
## 2024.10.28+1

### Fixed
- [Jose] Corregido error a la hora de detectar cambios en directorios
- [Jose] Corregido reseteo de versión al compilar

---
## 2024.10.25+1

### Fixed
- [Jose] Correcciones varias de estabilidad

---
## 2024.10.24+1

### Fixed
- [Jose] Correcciones varias de estabilidad

---
## 2024.10.23+1

### Added
- [Jose] Se ha migrado las herramientas, la configuración de compilación y la información para desplegar desde el viejo workspace `framework/services-comun`
    - Las clases utilizadas en este workspace no se exportan fuera del mismo, son privadas por lo que no son accesibles desde el resto de workspaces
    - Las herramientas no se almacenan compiladas en el repositorio, si se intentan lanzar antes de compilarlas primero se autocompilan por si mismas
