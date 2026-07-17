# CODEMAP — `@mr/core/dev/patches/`

> Generado: 2026-06-16. Actualizar al añadir nuevas reglas.
> Ejecutar: `yarn run patch:apply` (alias de `yarn workspace @mr/core-dev mrpack:patch:apply`).
> Última revisión: 2026-07-17 (documentadas R028-R034, que faltaban desde su introducción;
> corregido bug real en `getRulesSince`/cursor — ver nota bajo "Funciones internas" — y
> eliminado un bloque de texto inyectado que sustituía la nota de orden real).

---

## Árbol de directorios

```
patches/
├── index.mjs            Runner principal — escanea ficheros y ejecuta reglas
├── rule-factory.mjs     Factorías de reglas reutilizables
└── rules/               Una regla por fichero
    ├── breaking-forward-incomming-connection-rename.mjs   R014
    ├── deprecated-conexion-import.mjs                     R001
    ├── deprecated-config-config-import.mjs                R004
    ├── deprecated-config-dominio-import.mjs               R005
    ├── deprecated-frontend-device-import.mjs              R016
    ├── deprecated-i18n-index-import.mjs                   R007
    ├── deprecated-i18n-net-import.mjs                     R006
    ├── deprecated-net-checkers-import.mjs                 R013
    ├── deprecated-net-device-import.mjs                   R009
    ├── deprecated-net-interface-import.mjs                R008
    ├── deprecated-net-request-parser-json-import.mjs      R015
    ├── deprecated-net-server-import.mjs                   R012
    ├── deprecated-net-service-import.mjs                  R011
    ├── deprecated-net-utiles-import.mjs                   R010
    ├── deprecated-portal-config-import.mjs                R019
    ├── deprecated-portal-idiomas-import.mjs               R020
    ├── deprecated-portal-meteored-import.mjs              R018
    ├── deprecated-portal-seccion-import.mjs               R017
    ├── deprecated-services-cluster-import.mjs             R021
    ├── deprecated-services-main-import.mjs                R022
    ├── deprecated-engine-base-import.mjs                  R023
    ├── deprecated-engine-server-import.mjs                R024
    ├── deprecated-workload-net-config-import.mjs          R025
    ├── deprecated-meteored-utiles-config-import.mjs       R026
    ├── deprecated-utiles-pod-import.mjs                   R027
    ├── deprecated-routes-group-block-import.mjs           R003
    ├── deprecated-routes-group-import.mjs                 R002
    ├── deprecated-portal-tiempo-dominios-import.mjs       R028
    ├── deprecated-portal-tiempo-loader-import.mjs         R029
    ├── deprecated-portal-tiempo-import.mjs                R030
    ├── breaking-dominio-tiempo-rename.mjs                 R031
    ├── breaking-user-tiempo-domain-default-import.mjs     R032
    ├── breaking-dominio-tiempo-list-rename.mjs            R033
    ├── deprecated-frontend-legacy-import.mjs              R034
    └── sync-mr-devdeps.mjs                                WS001
```

---

## `index.mjs` — Runner principal

### Responsabilidades
- Lee el cursor `patch` de `config.workspaces.json` para saber desde qué regla continuar.
- Camina el árbol del monorepo (raíz inferida desde la ubicación del script, 4 niveles arriba) buscando ficheros `.ts`, `.tsx`, `.js`, `.mjs`, `.cjs`.
- Aplica las **reglas de fichero** (`RULES`) en orden sobre cada fichero.
- Aplica las **reglas de workspace** (`WORKSPACE_RULES`) una vez sobre la raíz.
- Actualiza el cursor al ID del último patch aplicado.
- Emite un spinner en stderr durante el escaneo.

### Directorios excluidos
`.git`, `.idea`, `.vscode`, `.yarn`, `deprecated`, `node_modules`, `output`, `dist`, `build`, `coverage`, `tmp`

### Funciones internas
```js
parseArgs(argv)                              // → { verbose: boolean }
getPatchCode(value)                          // → "R014" | undefined
getPatchNumber(value)                        // → 14 | undefined
getRulesSince(lastPatch)                     // → Rule[] — reglas con numero > cursor (SIEMPRE numerico, ver nota abajo)
highestPatchCode(rules)                      // → "R034" | undefined — ID de mayor numero dentro de `rules`
readPatchCursor()                            // → "R014" | undefined — lee config.workspaces.json
writePatchCursor(patch)                      // escribe config.workspaces.json
walk(dir, out, {skipRootI18n?})             // walk recursivo de ficheros con extensión TARGET_EXT
processFile(filePath, rules)                 // → { changed, hits[] } — aplica rules sobre un fichero
```

> **El array `RULES` NO está en orden numérico — el cursor sí lo compara numéricamente.**
> `getRulesSince`/`highestPatchCode` comparan siempre por `getPatchNumber(rule.id)`, nunca por
> la posición del ID dentro del array. Es un requisito, no un detalle de implementación: R034
> vive en la posición 17 del array (antes que R017-R033) porque debe evaluarse junto a R016
> para evitar matches parciales de subpath, pero es numéricamente la regla más reciente. Un
> bug anterior usaba `RULES.findIndex(...)` + `slice(index + 1)` (posición en el array) para
> decidir qué reglas están pendientes — con cursor `R033` (última posición del array), eso
> devolvía `[]` y `patch:apply` nunca llegaba a ejecutar R034 pese a que `34 > 33`. Al añadir
> una regla fuera de orden numérico, confirma siempre que `getRulesSince("R0XX-1")` incluye la
> nueva regla en su resultado.

### Orden de evaluación de `RULES` (importante: subpaths antes que paths padre; NO es el orden numérico)
```
R003 → R002 → R006 → R007 → R004 → R005 → R001 → R008 → R009 → R010
→ R011 → R012 → R013 → R014 → R015 → R016 → R034 → R017 → R019 → R020
→ R018 → R021 → R022 → R023 → R024 → R025 → R026 → R027 → R028 → R029
→ R030 → R031 → R032 → R033
```

### `WORKSPACE_RULES`
```
WS001  — syncMrDevDepsRule
```

---

## `rule-factory.mjs` — Factorías

Todas las funciones retornan un objeto regla con la forma:
```js
{ id: string, summary: string, apply(content, filePath?) }     // reglas de fichero
{ id: string, summary: string, type: "workspace", run(rootDir) } // reglas de workspace
```

### `isModuleLine(line): boolean`
Detecta si una línea contiene un especificador de módulo (import/export/require) y no es un comentario.

### `collapseMultilineImports(content, source): string`
Colapsa imports multiínea que contienen `source` en una sola línea antes de procesarlos.

### `createSimpleRule({id, summary, source, target, skipIfContains?})`
Sustituye `source` por `target` en todas las líneas de módulo.
- `skipIfContains[]` — omite líneas que contengan alguno de estos strings (para evitar solapamiento entre reglas hermanas).

### `createLineRegexRule({id, summary, detect, regex, replacement, skipFilePathIncludes?, skipComments?})`
Aplica una regex a líneas que contengan `detect`.
- `skipFilePathIncludes[]` — no aplica si el path del fichero contiene alguno de estos strings (útil para que las reglas no se auto-apliquen).

### `createSplitRule({id, summary, source, targets})`
Divide un import de `source` en varios imports separados por módulo de destino.
- `targets[].symbols` — símbolos que van a ese target.
- `targets[].target` — nuevo path de importación.
- `targets[].renames` — `{ nombreViejo: nombreNuevo }` para renombrar símbolos.

### `createWorkspaceRule({id, summary, run})`
Regla de nivel workspace. `run(rootDir)` recibe la raíz del monorepo y devuelve `{ changed: number }`.

---

## Reglas de fichero (`rules/`)

| ID | Fichero | Tipo | `source` → `target` |
|----|---------|------|----------------------|
| R001 | `deprecated-conexion-import.mjs` | simple | `services-comun/modules/net/conexion` → `@mr/core-network/server/http/conexion` |
| R002 | `deprecated-routes-group-import.mjs` | simple | `services-comun/modules/net/routes/group` → `@mr/core-network/server/http/routes/group` *(skipIfContains: `.../group/block`)* |
| R003 | `deprecated-routes-group-block-import.mjs` | simple | `services-comun/modules/net/routes/group/block` → `@mr/core-network/server/http/routes/group/block` |
| R004 | `deprecated-config-config-import.mjs` | simple | `services-comun/modules/net/config/config` → `@mr/core-network/server/http/config/config` |
| R005 | `deprecated-config-dominio-import.mjs` | simple | `services-comun/modules/net/config/dominio` → `@mr/core-network/server/http/config/dominio` |
| R006 | `deprecated-i18n-net-import.mjs` | simple | `services-comun/modules/net/i18n/net` → `@mr/core-network/server/http/i18n` |
| R007 | `deprecated-i18n-index-import.mjs` | simple | `services-comun/modules/net/i18n` → `@mr/core-i18n/langs` *(skipIfContains: `.../i18n/net`)* |
| R008 | `deprecated-net-interface-import.mjs` | simple | `services-comun/modules/net/interface` → `@mr/core-network/client/http/interface` |
| R009 | `deprecated-net-device-import.mjs` | simple | `services-comun/modules/net/device` → `@mr/core-network/server/http/config/device` |
| R010 | `deprecated-net-utiles-import.mjs` | split | `services-comun/modules/net/utiles` → `isBot` → `isbot` (pkg `isbot`) · `randomUA` → `@mr/core-network/client/ua` |
| R011 | `deprecated-net-service-import.mjs` | simple | `services-comun/modules/net/service` → `@mr/core-network/server/http/service` |
| R012 | `deprecated-net-server-import.mjs` | simple | `services-comun/modules/net/server` → `@mr/core-network/server/http/server` |
| R013 | `deprecated-net-checkers-import.mjs` | simple | `services-comun/modules/net/checkers` → `@mr/core-network/server/http/checkers` |
| R014 | `breaking-forward-incomming-connection-rename.mjs` | lineRegex | `.forwardIncommingConnection(` → `.forwardIncomingConnection(` *(skipFilePathIncludes: `/@mr/core/dev/patches/`)* |
| R015 | `deprecated-net-request-parser-json-import.mjs` | simple | `services-comun/modules/net/request/parser/json` → `@mr/core-network/client/http/parser/json` |
| R016 | `deprecated-frontend-device-import.mjs` | simple | `services-comun/modules/frontend/device` → `@mr/core-templates/device` |
| R017 | `deprecated-portal-seccion-import.mjs` | simple | `services-comun-meteored/modules/portal/meteored/seccion/` → `@mr/user-mr-domain/section/` |
| R018 | `deprecated-portal-meteored-import.mjs` | simple | `services-comun-meteored/modules/portal/meteored` → `@mr/user-mr-domain` |
| R019 | `deprecated-portal-config-import.mjs` | simple | `services-comun-meteored/modules/portal/meteored/config/` → `@mr/user-mr-domain/config/` |
| R020 | `deprecated-portal-idiomas-import.mjs` | simple | `services-comun-meteored/modules/portal/idiomas` → `@mr/user-mr-domain/idiomas` |
| R021 | `deprecated-services-cluster-import.mjs` | simple | `services-comun/cluster` → `@mr/core-workload/cluster` |
| R022 | `deprecated-services-main-import.mjs` | simple | `services-comun/main` → `@mr/core-workload` *(skipIfContains: `services-comun/cluster`)* |
| R023 | `deprecated-engine-base-import.mjs` | lineRegex | `import {EngineBase} from "services-comun/modules/engine_base"` → `import {Engine as EngineBase} from "@mr/core-workload/engine"` |
| R024 | `deprecated-engine-server-import.mjs` | lineRegex | `import {EngineServer} from "services-comun/modules/engine_server"` → `import {Engine as EngineServer} from "@mr/core-workload/engine/server"` |
| R025 | `deprecated-workload-net-config-import.mjs` | custom | `import {ConfiguracionNet, IConfiguracionNet} from "@mr/core-network/server/http/config/config"` → `import {ConfiguracionNet, type IConfiguracionNet} from "@mr/core-workload/config/net"` *(acepta multilínea, orden inverso y coma final)* |
| R026 | `deprecated-meteored-utiles-config-import.mjs` | custom | `import {...} from "services-comun/modules/utiles/config"` → split en `@mr/core-utils/config` + `@mr/core-workload/config/google` + `@mr/core-workload/config/google/storage` + `@mr/core-workload/config/pod` + `@mr/core-workload/config` *(incluye renames y deja leftovers en origen)* |
| R027 | `deprecated-utiles-pod-import.mjs` | simple | `services-comun/modules/utiles/pod` → `@mr/core-workload/config/pod` |
| R028 | `deprecated-portal-tiempo-dominios-import.mjs` | simple | `services-comun-meteored/modules/portal/tiempo/dominios/*` → `@mr/user-tiempo-domain/sites/*` |
| R029 | `deprecated-portal-tiempo-loader-import.mjs` | simple | `services-comun-meteored/modules/portal/tiempo/loader` → `@mr/user-tiempo-domain/loader` |
| R030 | `deprecated-portal-tiempo-import.mjs` | simple | `services-comun-meteored/modules/portal/tiempo` → `@mr/user-tiempo-domain` *(preserva `TPlataforma`; si coexiste con otros símbolos, divide en dos sentencias)* |
| R031 | `breaking-dominio-tiempo-rename.mjs` | specifierRename | `{DominioTiempo}` de `@mr/user-tiempo-domain` *(breaking)* → `{Dominio as DominioTiempo}` |
| R032 | `breaking-user-tiempo-domain-default-import.mjs` | custom | `import Foo from "@mr/user-tiempo-domain"` *(default export eliminado)* → `import {Dominio as Foo} from "@mr/user-tiempo-domain"` *(también `import type` y mixto `Foo, {Bar}`)* |
| R033 | `breaking-dominio-tiempo-list-rename.mjs` | specifierRename | `{DominioTiempoList}` de `@mr/user-tiempo-domain/loader` *(breaking)* → `{DominioList as DominioTiempoList}` |
| R034 | `deprecated-frontend-legacy-import.mjs` | simple | `services-comun/modules/frontend` → `@mr/core-templates/legacy` |

> **Nota de orden:** subpaths deben ir **antes** que sus paths padre en `RULES` para evitar
> matches parciales (p.ej. R017/R019 antes que R018; R034 antes que R016/R017 por la misma
> razón). Esto es independiente del número de la regla — ver nota sobre `getRulesSince` más
> arriba.
