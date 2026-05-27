# [Changelog](https://keepachangelog.com/en/1.1.0/)

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


