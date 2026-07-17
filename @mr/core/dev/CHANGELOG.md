# [Changelog](https://keepachangelog.com/en/1.1.0/)

---

## 2026.7.17

### Added — `CLAUDE.md`

- [Jose] **Nuevo fichero canónico `CLAUDE.md`**, expuesto en la raíz del monorepo mediante
  symlink (gestionado por la nueva `initClaude()` de `@mr/cli`, ver su changelog). Claude
  Code no lee `AGENTS.md` ni `.github/copilot-instructions.md` automáticamente — ni siquiera
  de forma transitiva, ya que la mención a este último dentro de `AGENTS.md` es solo texto
  entre backticks, no un import — así que `CLAUDE.md` los importa explícitamente con
  `@AGENTS.md` y `@.github/copilot-instructions.md` para que Claude reciba las mismas
  instrucciones que Copilot/Codex sin duplicar contenido.

### Changed — `AGENTS.md`, `.github/copilot-instructions.md`

- [Jose] Documentado el esquema de symlinks/imports anterior en ambos ficheros: la nota de
  cabecera de `copilot-instructions.md` ahora menciona también `CLAUDE.md` (symlink de
  fichero, igual que `AGENTS.md`), y `AGENTS.md` aclara en "Convenciones no obvias" que solo
  `CLAUDE.md` importa realmente su contenido y el de `copilot-instructions.md` para Claude
  Code.

### Changed — `AGENTS.md`

- [Jose] **"Flujos de trabajo criticos" documenta ahora la compilación de un único
  workspace**, distinguiéndola de la ejecución. Verificado directamente en
  `@mr/cli/src/mrpack/clases/workspace/service.ts` (líneas ~491/608: los `spawn` que lanza
  `mrpack devel` por cada workspace): compilar uno solo es `yarn run <workspace> run packd`
  (una sola vez, sin watch); ejecutarlo/depurarlo es `yarn run <workspace> run devel`
  (`run dev` en Next.js) y requiere que `output/` ya esté compilado. También se corrige la
  descripción de `yarn run packd` (compilación de todos los habilitados): por defecto es
  **una sola vez** (termina al acabar), no "watch" — el watch solo se activa con `-w`.
- [Jose] **Un agente de IA que compile todo el proyecto debe añadir siempre `-f`/`--forzar`
  junto a `-c`**: `yarn mrpack devel -c -f` (= `yarn run packd-f`), no solo `yarn mrpack devel -c`
  (= `yarn run packd`). Sin `-f`, la compilación solo cubre los workspaces marcados como
  habilitados en `config.workspaces.json` (`packd.available`/`packd.disabled`), que es una
  configuración local por desarrollador — sin `-f` un agente podría dar por buena una
  compilación que en realidad se saltó services/jobs/cronjobs deshabilitados en esa máquina.

---

## 2026.7.13

### Fixed — `bundler/esbuild/esbuild.config.mjs`

- **`tscBin` fallaba con `ERR_PACKAGE_PATH_NOT_EXPORTED` tras actualizar a TypeScript 7**:
  `require.resolve("typescript/bin/tsc")` dejó de funcionar porque TypeScript 7 ya no
  expone el subpath `./bin/tsc` en el campo `exports` de su `package.json` (aunque el
  fichero sigue existiendo físicamente). Ahora `tscBin` se resuelve componiendo la ruta a
  partir de `typescript/package.json` (`dirname(require.resolve("typescript/package.json"))`
  + `bin/tsc`), evitando depender de subpaths restringidos por `exports`.

### Changed — `package.json`, `bundler/esbuild/README.md`

- **`typescript` revertido de `^7.0.2` a `^6.0.3`**: el compilador nativo de TypeScript 7
  (Go, "Corsa"/`tsgo`) todavía no soporta resolución de módulos bajo Yarn PnP (ver
  [microsoft/typescript-go#460](https://github.com/microsoft/typescript-go/issues/460),
  PR [#1966](https://github.com/microsoft/typescript-go/pull/1966) sin fusionar). Con TS7,
  `tsc --noEmit`/`--watch` no resolvía ningún módulo de workspace (`services-comun/...`,
  `@mr/core-*`, etc.), aunque esbuild sí compilaba correctamente. Documentada la limitación
  en `bundler/esbuild/README.md` para no repetir el upgrade hasta que el soporte de PnP esté
  publicado en una versión estable de TS7.

---

## 2026.6.26

### Added

- `patches/rules/breaking-user-tiempo-domain-default-import.mjs` — nueva regla **R032**
  que migra los imports por defecto de `@mr/user-tiempo-domain` (cuyo `export default`
  fue eliminado) al export nombrado `Dominio`. Cubre tres variantes:

  | Entrada | Salida |
  |---------|--------|
  | `import Foo from "@mr/user-tiempo-domain"` | `import {Dominio as Foo} from "@mr/user-tiempo-domain"` |
  | `import type Foo from "@mr/user-tiempo-domain"` | `import type {Dominio as Foo} from "@mr/user-tiempo-domain"` |
  | `import Foo, {Bar} from "@mr/user-tiempo-domain"` | `import {Dominio as Foo, Bar} from "@mr/user-tiempo-domain"` |

  Imports ya nombrados (`{Dominio as Foo}`), subpaths (`@mr/user-tiempo-domain/sites/…`)
  y otros módulos no se modifican.

- `patches/rules/breaking-dominio-tiempo-list-rename.mjs` — nueva regla **R033** que
  renombra el especificador `DominioTiempoList` en imports de `@mr/user-tiempo-domain/loader`:

  ```ts
  // antes
  import {DominioTiempoList} from "@mr/user-tiempo-domain/loader";
  import {type DominioTiempoList} from "@mr/user-tiempo-domain/loader";

  // después
  import {DominioList as DominioTiempoList} from "@mr/user-tiempo-domain/loader";
  import {type DominioList as DominioTiempoList} from "@mr/user-tiempo-domain/loader";
  ```

  Usa `createSpecifierRenameRule` con lookbehind `(?<! as )` para garantizar idempotencia.

- `patches/rule-factory.mjs` — nueva función exportada **`createSpecifierRenameRule({id, summary, module, detect, regex, replacement})`**.
  Factoría para el patrón "renombrar un especificador dentro de imports de un módulo concreto".
  Aplica `collapseMultilineImports` automáticamente antes de procesar, gestiona el
  conteo de reemplazos y es idempotente si la regex incluye el lookbehind adecuado.

- `patches/rule-factory.mjs` — nueva constante exportada **`SKIP_DIRS`** (`Set<string>`):
  el conjunto de directorios ignorados por el runner (`.git`, `node_modules`, `output`, etc.).
  Antes estaba duplicado en `index.mjs` y en `sync-mr-devdeps.mjs`; ahora ambos lo
  importan de la misma fuente.

### Changed

- `patches/rules/breaking-dominio-tiempo-rename.mjs` (**R031**) — simplificado usando
  `createSpecifierRenameRule`. El fichero pasa de ~35 líneas con implementación manual
  a una llamada declarativa de 10 líneas. Comportamiento idéntico.

- `patches/index.mjs` — elimina la definición local de `SKIP_DIRS` e importa la
  constante desde `rule-factory.mjs`.

- `patches/rules/sync-mr-devdeps.mjs` — elimina la definición local de `SKIP_DIRS`
  y la regexp `MODULE_LINE_RE`; ahora importa `{isModuleLine, SKIP_DIRS}` desde
  `rule-factory.mjs`. El filtrado de líneas de comentario mejora ligeramente
  (evita contar `// import @mr/foo` como import real).


### Added

- `patches/rules/deprecated-engine-server-import.mjs` — nueva regla **R024** que migra
  imports de `services-comun/modules/engine_server`:

  ```ts
  import {EngineServer} from "services-comun/modules/engine_server";
  ```

  a:

  ```ts
  import {Engine as EngineServer} from "@mr/core-workload/engine/server";
  ```

  La regla usa `createLineRegexRule`, mantiene `import type` si existiese y evita
  auto-aplicarse sobre `@mr/core/dev/patches/*`.

- `patches/index.mjs` — registrada la regla **R024** en `RULES`.

- `patches/README.md` y `patches/CODEMAP.md` — tablas de reglas y orden de ejecución
  actualizados para incluir **R024**.

## 2026.6.15+1

### Added

- `/.github/git-commit-instructions.md` (canónico en `@mr/core/dev/.github/git-commit-instructions.md`) —
  nuevo archivo de instrucciones para commits que indica usar español (España)
  al generar mensajes de commit.

## 2026.6.10+2

### Added

- `patches/rules/sync-mr-devdeps.mjs` — nueva **regla de workspace WS001**.
  Escanea todos los ficheros `.ts` de cada workspace del monorepo, extrae los
  paquetes `@mr/<scope>` que se importan y, si alguno no está declarado en
  `dependencies`, `devDependencies`, `peerDependencies` u `optionalDependencies`
  del `package.json` del workspace, lo añade en `devDependencies` con
  `"workspace:*"`. El resultado de `devDependencies` queda ordenado
  alfabéticamente. La regla es idempotente y no usa el cursor de patch.

- `patches/rule-factory.mjs` — nueva función exportada `createWorkspaceRule({id, summary, run})`.
  Devuelve un objeto `{id, summary, type: "workspace", run}` para reglas que
  operan a nivel de workspace en lugar de a nivel de fichero individual.

- `patches/index.mjs` — nuevo array `WORKSPACE_RULES`. Tras el bucle de ficheros,
  se ejecutan todas las workspace-rules siempre que `activeRules.length > 0`
  (es decir, cuando hay algún patch pendiente). El informe final distingue
  cambios de ficheros (`R0xx`) y cambios de workspace (`WS001`):

  ```
  mrpack-patch: actualizados 3 archivo(s) (R020=3) + workspace (WS001=2)
  ```

- `patches/rules/deprecated-portal-idiomas-import.mjs` — nueva regla **R020** que
  migra imports de `services-comun-meteored/modules/portal/idiomas` a
  `@mr/user-mr-domain/idiomas`. Se ubica antes de R018 en `RULES` para evitar
  que el patrón genérico `/meteored/*` la capture primero.

- `patches/README.md` — tabla de reglas actualizada con R016-R020; nueva subsección
  **"Reglas de workspace (`WORKSPACE_RULES`)"** con la tabla de WS001; nueva
  subsección **"Regla de workspace (opera sobre `package.json`)"** con ejemplo
  de uso de `createWorkspaceRule`.

---

## 2026.6.10+1

### Added

- `patches/rules/deprecated-frontend-device-import.mjs` — nueva regla **R016** que
  migra imports de `services-comun/modules/frontend/device` a
  `@mr/core-templates/device`.

- `patches/rules/deprecated-portal-seccion-import.mjs` — nueva regla **R017** que
  migra imports de `services-comun-meteored/modules/portal/meteored/seccion/*` a
  `@mr/user-mr-domain/section/*`.

- `patches/rules/deprecated-portal-meteored-import.mjs` — nueva regla **R018** que
  migra imports de `services-comun-meteored/modules/portal/meteored/*` a
  `@mr/user-mr-domain/*` (patrón genérico, aplicado después de R017 y R019).

- `patches/rules/deprecated-portal-config-import.mjs` — nueva regla **R019** que
  migra imports de `services-comun-meteored/modules/portal/meteored/config/*` a
  `@mr/user-mr-domain/config/*`.

- `patches/index.mjs` — registradas las reglas R016, R017, R018 y R019.

---

## 2026.6.3+4

### Changed

- `README.md` — sección **"Parches de migración"** actualizada: añadida nota de que
  `yarn run patch:apply` se ejecuta automáticamente después de instalar, actualizar o
  resetear frameworks mediante `yarn mrpack framework` o `yarn mrpack update`, por lo
  que normalmente no es necesario invocarlo a mano.

---

## 2026.6.3+3

### Changed

- `package.json` — `mrpack:patch:apply` simplificado de
  `node patches/index.mjs --write` a `node patches/index.mjs`.

- `patches/index.mjs` — eliminado el modo dual `--write/--check`; el script
  funciona siempre en modo apply incremental (cursor `config.workspaces.json.patch`).
  Se mantiene `--verbose` como opción opcional de salida detallada.

- `patches/README.md` — actualizado el ejemplo de uso de `--verbose` sin `--check`.

---

## 2026.6.3+2

### Changed

- `patches/index.mjs` — `yarn run patch:apply` pasa a usar el campo opcional
  `patch` de `config.workspaces.json` como cursor de migración:
  - Solo ejecuta reglas posteriores al ID indicado (ej.: `R012` => aplica `R013+`).
  - Si no hay reglas nuevas, finaliza sin escanear (`mrpack-patch: no hay patches nuevos`).
  - Tras ejecutar en modo `--write`, actualiza `config.workspaces.json.patch` al último
    patch procesado, incluso cuando no hubo cambios en archivos.

- `patches/README.md` — documentado el flujo incremental por cursor `patch`.

---

## 2026.6.3+1

### Changed

- `/.github/copilot-instructions.md` (canónico en `@mr/core/dev/.github/copilot-instructions.md`) —
  añadida la sección **"Frameworks del monorepo"** para dejar explícito que `@mr/cli`,
  `@mr/core/*`, `@mr/user/*` y `framework/*` se tratan como frameworks y se gestionan
  mediante `yarn mrpack framework` / `yarn mrpack framework --send`.

---

## 2026.5.27+2

### Added

- `manifest/deployment/lambda/index.ts` — nueva propiedad `vpc: boolean` en
  `IManifestDeploymentLambda` y `ManifestDeploymentLambda`. Cuando es `true`, el servicio
  Cloud Run se conecta a la VPC del proyecto; la anotación `vpc-access-egress` y la
  configuración de `network-interfaces` solo se aplican si este flag está activo.
  Por defecto su valor es `false`.

### Changed

- `manifest/deployment/lambda/index.ts` — añadidos bloques JSDoc a los tipos `Egress`,
  `Ingress` e `IManifestDeploymentLambda`, y corregido el JSDoc de la clase
  `ManifestDeploymentLambda` (antes referenciaba incorrectamente `deploy.annotations`).

- `manifest/deployment/index.ts` — añadida la propiedad `lambda` al bloque `@property` del
  JSDoc de `IManifestDeployment`.

- `manifest/README.md` — tabla `IManifestDeploymentLambda` actualizada con la fila `vpc` y
  el ejemplo JSON ampliado con `"vpc": true`.

---

## 2026.5.27+1

### Added

- `manifest/deployment/lambda/index.ts` — nuevo módulo con el modelo `ManifestDeploymentLambda`
  y los tipos auxiliares `Egress` / `Ingress` (type + const namespace).
  Permite configurar el tráfico entrante (`ingress`) y saliente (`egress`) de un servicio
  Cloud Run al desplegar con `target: "lambda"`.

  ```ts
  export type Egress = "all-traffic" | "private-ranges-only";
  export type Ingress = "all" | "internal-and-cloud-load-balancing";

  export interface IManifestDeploymentLambda {
      egress?: Egress;
      ingress: Ingress;
  }
  ```

### Changed

- `manifest/deployment/index.ts` — añadido el campo `lambda?: IManifestDeploymentLambda` a
  `IManifestDeployment` y `ManifestDeployment`. El constructor hidrata el campo usando
  `ManifestDeploymentLambda.build(...)` cuando está presente, y `toJSON()` lo serializa de vuelta.

- `manifest/deployment/annotations.ts` — el módulo pasa de
  `manifest/deployment/annotations/index.ts` a `manifest/deployment/annotations.ts`
  (directorio eliminado). El comportamiento es idéntico; la ruta de import ha sido actualizada
  en `deployment/index.ts`.

- `manifest/README.md` — árbol de modelos actualizado con la nueva ruta de `annotations.ts`,
  la entrada `lambda` en el árbol y en la tabla de `IManifestDeployment`, y la nueva sección
  `IManifestDeploymentLambda` con tablas de `Ingress` / `Egress` y ejemplo JSON.

---

## 2026.5.22+1

### Added

- `patches/rules/deprecated-net-request-parser-json-import.mjs` — nueva regla **R015** que
  migra imports de `services-comun/modules/net/request/parser/json` a
  `@mr/core-network/client/http/parser/json`.
- `patches/index.mjs` — registrada la regla R015.
- `patches/README.md` — añadida fila R015 en la tabla de reglas.

### Fixed

- `patches/rule-factory.mjs` — los imports multilínea ahora son procesados correctamente
  por todas las reglas.

  **Problema:** `isModuleLine` solo reconocía líneas que empezaban por `import`, `export` o
  `require(`. La línea de cierre de un import multilínea (`} from "ruta";`) no superaba
  ese filtro y quedaba sin transformar, dejando el path deprecado intacto.

  **Solución en dos partes:**

  1. Nueva constante `MULTILINE_CLOSE_RE = /^\s*\}\s+from\s+["']/` añadida a `isModuleLine`.
     Permite que `createSimpleRule` reemplace el path en la línea de cierre preservando el
     formato multilínea:

     ```ts
     // Antes: sin cambios
     import {
         ConfiguracionNet,
         IConfiguracionNet,
     } from "services-comun/modules/net/config/config";

     // Después: path corregido, formato respetado
     import {
         ConfiguracionNet,
         IConfiguracionNet,
     } from "@mr/core-network/server/http/config/config";
     ```

  2. Nueva función exportada `collapseMultilineImports(content, source)` que, antes del
     procesamiento línea a línea en `createSplitRule`, colapsa a una sola línea únicamente
     los bloques import que contienen el `source` buscado. Esto permite que la lógica de
     extracción de símbolos (`{...}`) funcione también con imports multilínea.

---

## 2026.5.21+3

### Changed

- `bundler/rspack/module.ts` — `sass-loader` migrado a `sass-embedded` con la API
  `"modern-compiler"`.

  | Antes | Después |
  |-------|---------|
  | `implementation: require.resolve("sass")` | `implementation: require.resolve("sass-embedded")` |
  | `api` no especificado (legacy por defecto) | `api: "modern-compiler"` |

  **Por qué mejora:**

  - **`sass-embedded`** ejecuta el motor Dart Sass compilado a binario nativo (AoT) en lugar
    del paquete `sass` que corre el mismo motor transpilado a JavaScript. El binario nativo es
    considerablemente más rápido en proyectos con muchas hojas de estilo.

  - **`api: "modern-compiler"`** permite que `sass-loader` reutilice una única instancia del
    compilador para todos los ficheros del build en lugar de arrancar una nueva por cada
    entrada. Esto elimina el overhead de inicialización repetida y reduce el tiempo total de
    compilación SCSS, especialmente notable en modo watch donde se recompila en caliente.

---

## 2026.5.21+2

### Added

- `manifest/deployment/annotations/index.ts` — nuevo modelo `ManifestDeploymentAnnotations`
  con su interfaz `IManifestDeploymentAnnotations` para representar `deploy.annotations`.

### Changed

- `manifest/deployment/index.ts` — `IManifestDeployment` y `ManifestDeployment` incluyen
  ahora la propiedad opcional `annotations`, con serialización en `toJSON()`.
- `manifest/README.md` — documentada la nueva sección `IManifestDeploymentAnnotations`
  y el campo `deploy.annotations` en la tabla de referencia.

### Fixed

- `bundler/rspack/rspack.config.ts` — `dir` ahora se sanitiza con `replaceAll('"', "")` antes de
  usarla como ruta base.

  **Motivo:** cuando rspack recibe la ruta a través de `--env dir=...` desde la línea de comandos,
  en determinados entornos (Windows, rutas con espacios o según la shell) puede envolver el valor
  entre comillas dobles literales. Ese carácter llegaba intacto a las llamadas a `readJSONSync`,
  provocando que los ficheros `package.json` y `mrpack.json` no se encontrasen y la compilación
  fallase con `No se encontró package.json en: "ruta"`.

  El cambio sustituye la destructuración directa `dir: basedir` por la expansión `...resto` más
  la sanitización explícita, de modo que la ruta queda limpia independientemente del entorno de
  invocación.

---
## 2026.5.21+1

### Removed

- `package.json` — eliminada la dependencia `ts-node` de `devDependencies`. `@rspack/cli`
  carga `rspack.config.ts` a través de su propio motor SWC integrado (via pirates/`@swc/core`),
  por lo que `ts-node` nunca se invoca en el pipeline de compilación. Su presencia solo añadía
  peso y confusión sobre qué transformador TypeScript estaba activo.

---

## 2026.5.20+1

### Fixed

- `manifest/deployment/index.ts`, `manifest/build/index.ts`, `manifest/build/bundle/componentes.ts` —
  sustituidos todos los `const enum` (`Runtime`, `ManifestDeploymentKind`, `Target`, `BuildFW`,
  `ManifestBuildComponentesCSS`) por el patrón `type` + `const` con propiedades tipadas como
  el propio tipo unión.

  **Motivo:** En CI (Docker con Node 24), Yarn PnP carga su `pnp.loader.mjs` como loader ESM
  (`--import`). Cuando está activo este loader ESM, Node 24 intercepta la carga de ficheros `.ts`
  con su motor nativo en modo **strip-only** antes de que los hooks SWC/pirates de `@rspack/cli`
  puedan actuar. El modo strip-only elimina anotaciones de tipo pero **no puede transformar
  `const enum`** (que requiere inlining completo en tiempo de compilación), provocando el error:
  ```
  SyntaxError [ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX]: TypeScript enum is not supported in strip-only mode
  ```

  El patrón adoptado replica exactamente el comportamiento de `const enum`:
  - Cada miembro (`Runtime.browser`, etc.) tiene el tipo completo de la unión, no el literal
    estrecho `"browser"`, de modo que `.includes(value)` con valores de tipo `Runtime` compila
    sin errores `TS2345`.
  - Los valores en runtime son idénticos a los strings originales.
  - La API pública no cambia: los imports y usos existentes son compatibles sin modificación.

- `manifest/deployment/index.ts`, `manifest/build/index.ts`, `manifest/build/bundle/index.ts`,
  `manifest/build/bundle/base.ts`, `manifest/build/bundle/componentes.ts`,
  `manifest/build/database.ts`, `manifest/deployment/credenciales.ts`,
  `manifest/deployment/imagen/index.ts`, `manifest/deployment/imagen/entorno.ts`,
  `manifest/deployment/kustomize/index.ts`, `manifest/deployment/storage/index.ts`,
  `manifest/deployment/storage/buckets.ts`, `manifest/index.ts`, `manifest/root.ts`,
  `manifest/development.ts`, `bundler/rspack/configuracion.ts`, `bundler/rspack/devtool.ts`,
  `bundler/rspack/entry.ts`, `bundler/rspack/externals.ts`, `bundler/rspack/module.ts`,
  `bundler/rspack/optimization.ts`, `bundler/rspack/output.ts`, `bundler/rspack/plugins.ts`,
  `bundler/rspack/target.ts` —
  añadida extensión `.ts` explícita en todos los imports relativos (p.ej. `"./credenciales"` →
  `"./credenciales.ts"`, `"./imagen"` → `"./imagen/index.ts"`, etc.).

  **Motivo:** Yarn PnP en modo strip-only no añade `.ts` automáticamente a imports sin extensión,
  produciendo `ERR_QUALIFIED_PATH_RESOLUTION_FAILED`. El flag `allowImportingTsExtensions` en los
  tsconfigs permite el uso de estas extensiones explícitas en el código fuente.

### Changed

- `tsconfig/node.json`, `tsconfig/browser.json` — añadido `allowImportingTsExtensions: true`.
  Habilita extensiones `.ts` explícitas en los imports (require `moduleResolution: "bundler"`
  ya activo).

- `tsconfig.json` — añadido `allowImportingTsExtensions: true` para activar la opción en el
  tsconfig raíz del paquete.

- `bundler/rspack/tsconfig.json` — cambiado `extends` de `@tsconfig/node20` a `@tsconfig/node24`;
  añadido `allowImportingTsExtensions: true`.

---

## 2026.5.18+next

### Added

- `patches/rules/deprecated-net-service-import.mjs` — nueva regla **R011** que migra imports de
  `services-comun/modules/net/service` a `@mr/core-network/server/http/service`.
- `patches/index.mjs` — registrada la regla R011.
- `patches/README.md` — añadida fila R011 en la tabla de reglas.

- `patches/README.md` — añadida sección **"Instrucciones para agentes de IA"** al inicio
  del documento. Explica que cuando un agente reciba la indicación
  *"aplica los patches"* o *"aplica los parches"* debe ejecutar
  `yarn workspace @mr/core-dev mrpack:patch:apply`, y documenta el flujo completo
  recomendado tras `yarn mrpack update`.
- `README.md` — añadida entrada `Parches de migración` en la tabla de módulos y sección
  `## Parches de migración (mrpack:patch)` con nota para agentes de IA y tabla de comandos.

---

## 2026.5.13+1

### Added
- `bundler/rspack/README.md` — documentación completa del módulo rspack (arquitectura, ficheros,
  uso desde `rspack.config.ts`, descripción de cada builder).

### Changed
- `bundler/rspack/devtool.ts` — refactorizado de clase `Devtool` a función exportada `Devtool`.
  JSDoc fusionado en un único bloque con `@param` y `@returns`.
- `bundler/rspack/target.ts` — refactorizado de clase `Target` a función exportada `Target`.
  JSDoc fusionado en un único bloque con tabla comparativa de runtimes.
- `bundler/rspack/entry.ts` — refactorizado de clase `Entry` a funciones standalone.
  JSDoc de descripción movido al bloque de la función exportada `Entry`; añadidos `@param`.
- `bundler/rspack/module.ts` — refactorizado de clase `Module` a función exportada `Module`.
  JSDoc fusionado en un único bloque; eliminada sangría incorrecta del bloque `@param`.
- `bundler/rspack/optimization.ts` — refactorizado de clase `Optimization` a funciones standalone.
  JSDoc de descripción (con tabla) movido al bloque de la función exportada `Optimization`;
  corregida sangría de JSDoc de helper `buildNode`.
- `bundler/rspack/externals.ts` — refactorizado de clase `Externals` a funciones standalone;
  `ES_MODULES` y `checkVersion` como constante/función de módulo. JSDoc flotante movido a la
  función exportada `Externals`.
- `bundler/rspack/output.ts` — `css_critico` → `cssCritico` (camelCase). Propiedades de clase
  `implements TOutput` declaradas en el cuerpo sin JSDoc inline; documentación movida al bloque
  JSDoc de la clase con `@property`.
- `bundler/rspack/plugins.ts` — variable singleton renombrada `ok` → `tsCheckerRegistered`;
  `for...in` → `for...of Object.keys`; JSDoc completo de `IPluginsConfig`, función `buildBrowser`
  y función de fábrica principal.
- `bundler/rspack/configuracion.ts` — actualizado para usar `cssCritico`; corregido
  `**@mr/cli/**/*` → `**/@mr/cli/**/*` en `watchOptions.ignored`; JSDoc completo.
- `bundler/rspack/rspack.config.ts` — JSDoc completo de `IEnv`, `IPackageJson` y función de
  entrada; documentada la lógica de bundles secundarios web.

---

## 2026.5.12+1

### Added
- `README.md` completo del paquete con documentación de todos los módulos.
- `manifest/README.md` con referencia completa de todas las interfaces del modelo.
- JSDoc detallado en `types.d.ts` para todas las variables globales (`PRODUCCION`, `TEST`,
  `DESARROLLO`, `NEXTJS`, `ENTORNO`, `DATABASE`), incluyendo tabla de combinaciones válidas de entorno.

### Changed
- `tsconfig/node.json` — base actualizada a `@tsconfig/node24` (antes `@tsconfig/node20`).
  Añadidas opciones: `allowUnusedLabels: false`, `isolatedModules: false`, `resolveJsonModule: true`.
- `tsconfig/node.json` / `tsconfig/browser.json` — añadida opción `noImplicitOverride: true`,
  `noImplicitReturns: true` y `noPropertyAccessFromIndexSignature: true`.
- `tsconfig/browser.json` — añadida opción `resolveJsonModule: true`.


