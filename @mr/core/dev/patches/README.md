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
> Para comprobar si hay cambios pendientes sin escribir en disco (útil antes de aplicar):
>
> ```bash
> yarn run patch
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
> | `yarn run patch` | `yarn workspace @mr/core-dev mrpack:patch` |
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

### `yarn run patch`

Analiza el monorepo en modo lectura. **No escribe nada en disco.** Sale con codigo 1
si hay archivos pendientes de parche, lo que permite usarlo como gate en CI.

```bash
yarn run patch
```

Salida tipica cuando hay incidencias (exit code 1):

```
framework/services-comun/modules/net/conexion.ts: R001-deprecated-conexion-import x1
mrpack-patch: hay 1 archivo(s) pendientes (R001-deprecated-conexion-import=1)
```

Salida cuando todo esta limpio (exit code 0):

```
mrpack-patch: sin cambios
```

### `yarn run patch:apply`

Aplica todas las reglas activas sobre el workspace. Reescribe en disco los archivos
que contengan incidencias detectadas.

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

Para ver el detalle de todos los archivos escaneados añadir `--verbose`:

```bash
node @mr/core/dev/patches/index.mjs --check --verbose
```

---

## Integracion recomendada

Despues de actualizar dependencias:

```bash
yarn mrpack update
yarn run patch:apply
```

En CI, para bloquear merges con migraciones pendientes:

```bash
yarn run patch
```

---

## Reglas incluidas

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

### Probar antes de aplicar

```bash
yarn run patch
yarn run patch:apply
```
