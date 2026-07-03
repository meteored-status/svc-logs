# @mr/core-dev patches

Agente de parches de migracion para aplicar arreglos mecanicos tras `yarn mrpack update`.

---

## Instrucciones para agentes de IA

> Cuando se te indique **"aplica los patches"**, **"aplica los parches"** o cualquier
> variante equivalente, ejecuta el siguiente comando y nada más:
>
> ```bash
> yarn run patch:apply
> ```
>
> El flujo completo recomendado tras una actualización de dependencias es:
>
> ```bash
> yarn mrpack update
> yarn run patch:apply
> ```
>
> Los shorthands del `package.json` raíz mapean a:
>
> | Shorthand | Comando completo |
> |-----------|-----------------|
> | `yarn run patch:apply` | `yarn workspace @mr/core-dev mrpack:patch:apply` |

---

## Objetivo

Automatizar cambios repetitivos (imports deprecados, wrappers legacy, etc.) de forma
transparente al desarrollador:

1. Se actualizan paquetes (`yarn mrpack update`).
2. Se ejecuta el agente de parches.
3. Se aplican reglas seguras de autofix sobre todo el monorepo.
4. CI puede verificar que no quedan migraciones pendientes antes de mergear.

---

## Comandos disponibles

### `yarn run patch:apply`

Aplica todas las reglas activas sobre el workspace. Reescribe en disco los archivos
que contengan incidencias detectadas.

Desde `2026.6.3+2`, el comando usa el cursor opcional `patch` de `config.workspaces.json`
para aplicar solo reglas posteriores al último patch ejecutado.

```bash
yarn run patch:apply
```

Salida tipica:

```
framework/services-comun/modules/net/conexion.ts: R001-deprecated-conexion-import x1
mrpack-patch: actualizados 1 archivo(s) (R001-deprecated-conexion-import=1)
```

Si ningun archivo requiere cambios:

```
mrpack-patch: sin cambios
```

Si `config.workspaces.json` contiene:

```json
{
  "patch": "R012"
}
```

`patch:apply` evaluará únicamente `R013+`. Al finalizar (haya o no cambios), actualiza
`patch` al último ID procesado. Si no hay patches nuevos, finaliza directamente con:

```
mrpack-patch: no hay patches nuevos (ultimo: RXXX)
```

Para ver el detalle de todos los archivos escaneados añadir `--verbose`:

```bash
node @mr/core/dev/patches/index.mjs --verbose
```

---

## Integracion recomendada

Despues de actualizar dependencias:

```bash
yarn mrpack update
yarn run patch:apply
```

En CI, ejecutar `yarn run patch:apply` como parte del flujo de actualización
cuando corresponda.

---

## Reglas incluidas

### Reglas de fichero (`RULES`)

Se ejecutan sobre cada fichero individualmente. El cursor `config.workspaces.json.patch`
registra cuál fue la última regla aplicada para evitar reprocesar lo mismo.

| ID | Modulo deprecado | Target |
|----|-----------------|--------|
| `R001` | `services-comun/modules/net/conexion` | `@mr/core-network/server/http/conexion` |
| `R002` | `services-comun/modules/net/routes/group` | `@mr/core-network/server/http/routes/group` |
| `R003` | `services-comun/modules/net/routes/group/block` | `@mr/core-network/server/http/routes/group/block` |
| `R004` | `services-comun/modules/net/config/config` | `@mr/core-network/server/http/config/config` |
| `R005` | `services-comun/modules/net/config/dominio` | `@mr/core-network/server/http/config/dominio` |
| `R006` | `services-comun/modules/net/i18n/net` | `@mr/core-network/server/http/i18n` |
| `R007` | `services-comun/modules/net/i18n` | `@mr/core-i18n/langs` |
| `R008` | `services-comun/modules/net/interface` | `@mr/core-network/client/http/interface` |
| `R009` | `services-comun/modules/net/device` | `@mr/core-network/server/http/config/device` |
| `R010` | `services-comun/modules/net/utiles` (`isBot`, `randomUA`) | `isbot` + `@mr/core-network/client/ua` *(dos sentencias)* |
| `R011` | `services-comun/modules/net/service` | `@mr/core-network/server/http/service` |
| `R012` | `services-comun/modules/net/server` | `@mr/core-network/server/http/server` |
| `R013` | `services-comun/modules/net/checkers` | `@mr/core-network/server/http/checkers` |
| `R014` | `forwardIncommingConnection` *(breaking change)* | `forwardIncomingConnection` |
| `R015` | `services-comun/modules/net/request/parser/json` | `@mr/core-network/client/http/parser/json` |
| `R016` | `services-comun/modules/frontend/device` | `@mr/core-templates/device` |
| `R017` | `services-comun-meteored/modules/portal/meteored/seccion/*` | `@mr/user-mr-domain/section/*` |
| `R018` | `services-comun-meteored/modules/portal/meteored/*` | `@mr/user-mr-domain/*` |
| `R019` | `services-comun-meteored/modules/portal/meteored/config/*` | `@mr/user-mr-domain/config/*` |
| `R020` | `services-comun-meteored/modules/portal/idiomas` | `@mr/user-mr-domain/idiomas` |
| `R021` | `services-comun/cluster` | `@mr/core-workload/cluster` |
| `R022` | `services-comun/main` | `@mr/core-workload` |
| `R023` | `import {EngineBase} from "services-comun/modules/engine_base"` | `import {Engine as EngineBase} from "@mr/core-workload/engine"` |
| `R024` | `import {EngineServer} from "services-comun/modules/engine_server"` | `import {Engine as EngineServer} from "@mr/core-workload/engine/server"` |
| `R025` | `import {ConfiguracionNet, IConfiguracionNet} from "@mr/core-network/server/http/config/config"` | `import {ConfiguracionNet, type IConfiguracionNet} from "@mr/core-workload/config/net"` |
| `R026` | `import {...} from "services-comun/modules/utiles/config"` | split a `@mr/core-utils/config` + `@mr/core-workload/config/google` + `@mr/core-workload/config/google/storage` + `@mr/core-workload/config/pod` + `@mr/core-workload/config` (incluye renames `IConfigGenerico`/`ConfigGenerico`) |
| `R027` | `services-comun/modules/utiles/pod` | `@mr/core-workload/config/pod` |
| `R028` | `services-comun-meteored/modules/portal/tiempo/dominios/*` | `@mr/user-tiempo-domain/sites/*` |
| `R029` | `services-comun-meteored/modules/portal/tiempo/loader` | `@mr/user-tiempo-domain/loader` |
| `R030` | `services-comun-meteored/modules/portal/tiempo` | `@mr/user-tiempo-domain` *(preserva `TPlataforma` en el path original; si coexiste con otros símbolos, divide en dos sentencias)* |
| `R031` | `import {DominioTiempo} from "@mr/user-tiempo-domain"` *(breaking)* | `import {Dominio as DominioTiempo} from "@mr/user-tiempo-domain"` |
| `R032` | `import Foo from "@mr/user-tiempo-domain"` *(breaking: default export eliminado)* | `import {Dominio as Foo} from "@mr/user-tiempo-domain"` *(también maneja `import type` y mixto `Foo, {Bar}`)* |
| `R033` | `import {DominioTiempoList} from "@mr/user-tiempo-domain/loader"` *(breaking)* | `import {DominioList as DominioTiempoList} from "@mr/user-tiempo-domain/loader"` |

> **Orden de evaluación:** subpaths deben ir **antes** que sus paths padre en `RULES` para
> evitar matches parciales (p.ej. R017/R019 antes que R018).

### Reglas de workspace (`WORKSPACE_RULES`)

Se ejecutan **siempre que haya algún patch de fichero pendiente** (`activeRules.length > 0`).
No usan el cursor: son idempotentes por diseño y no modifican ficheros `.ts`.

| ID | Descripción |
|----|-------------|
| `WS001` | Escanea todos los `.ts` de cada workspace, detecta imports `@mr/*` ausentes en `package.json` y los añade en `devDependencies` con `"workspace:*"`. |

---

## Anadir nuevas reglas

### Regla simple (un source → un target)

La mayoría de migraciones son sustituir un path por otro. Una llamada es suficiente:

```js
// @mr/core/dev/patches/rules/mi-regla.mjs
import {createSimpleRule} from "../rule-factory.mjs";

export const miRegla = createSimpleRule({
    id: "R012-mi-regla",
    summary: "services-comun/modules/X -> @mr/Y",
    source: "services-comun/modules/X",
    target: "@mr/Y",
    // Opcional: omitir lineas que contengan estos strings (p.ej. subpaths con regla propia).
    skipIfContains: ["services-comun/modules/X/subpath"],
});
```

### Regla de renombrado de especificador (breaking change de nombre de export)

Cuando un export cambia de nombre dentro del mismo módulo (sin cambiar el path):

```js
// @mr/core/dev/patches/rules/mi-regla-rename.mjs
import {createSpecifierRenameRule} from "../rule-factory.mjs";

export const miReglaRename = createSpecifierRenameRule({
    id: "R031-mi-regla-rename",
    summary: "OldName -> NewName as OldName en imports de @mr/mi-paquete",
    module: "@mr/mi-paquete",       // path (o subpath) del módulo a vigilar
    detect: "OldName",              // substring rápido para filtrar líneas
    regex: /(?<! as )\bOldName\b/g, // lookbehind evita re-aplicar si ya está migrado
    replacement: "NewName as OldName",
});
```

Internamente usa `collapseMultilineImports` antes de procesar, por lo que funciona
con imports multilinea. El lookbehind `(?<! as )` garantiza idempotencia: si ya
existe `{NewName as OldName}` la regla no lo toca.

### Regla split (un source → varios targets)

Cuando el módulo deprecado re-exportaba símbolos de paquetes distintos:

```js
// @mr/core/dev/patches/rules/mi-regla-split.mjs
import {createSplitRule} from "../rule-factory.mjs";

export const miReglaSplit = createSplitRule({
    id: "R013-mi-regla-split",
    summary: "services-comun/modules/X -> pkgA + pkgB",
    source: "services-comun/modules/X",
    targets: [
        {symbols: ["FooClass"], target: "@mr/pkg-a"},
        {symbols: ["barFn"],    target: "@mr/pkg-b", renames: {barFn: "bar"}},
    ],
});
```

### Registrar la regla

Añadir el import y la entrada en `RULES` dentro de `@mr/core/dev/patches/index.mjs`.
Subpaths deben ir **antes** que sus paths padre en el array para evitar matches parciales.

### Esquema de IDs

Formato: `RXXX-descripcion-kebab`.
`XXX` no tiene límite de dígitos: R999 → R1000 → R1001...
El orden de evaluación lo controla `RULES`, no el número.

---

### Regla de workspace (opera sobre `package.json`)

Para lógica que necesita inspeccionar múltiples ficheros de un workspace y modificar
su `package.json` (u otros ficheros no-`.ts`):

```js
// @mr/core/dev/patches/rules/mi-regla-ws.mjs
import fs from "node:fs/promises";
import {createWorkspaceRule} from "../rule-factory.mjs";

export const miReglaWs = createWorkspaceRule({
    id: "WS002-mi-regla-workspace",
    summary: "Descripción corta de lo que hace",
    async run(rootDir) {
        // rootDir: ruta absoluta a la raíz del monorepo
        let changed = 0;
        // ... leer ficheros, actualizar package.json, etc.
        return {changed};
    },
});
```

Registrar en `WORKSPACE_RULES` dentro de `index.mjs` (no en `RULES`).

Las workspace-rules **no usan el cursor** y se ejecutan siempre que haya patches de
fichero pendientes (`activeRules.length > 0`). Deben ser idempotentes.

### Probar antes de aplicar

```bash
yarn run patch:apply
```
