# [Changelog](https://keepachangelog.com/en/1.1.0/)

---

## 2026.6.17+1 — [Jose]

### Documentation

- Actualizado `README.md` para reflejar los entrypoints publicos actuales y la referencia de migracion de routing.
- Actualizado `CODEMAP.md` para alinear el arbol de modulos, entrypoints y rutas internas con la estructura vigente del paquete.

## 2026.6.10+1 — [Jose]

### Removed

- **`base/seccion.ts`** — módulo de routing eliminado y transferido a `@mr/core-network/route`.
  La clase `Seccion` pasa a llamarse `Route` y ahora se importa desde `@mr/core-network/route`.
  - Se elimina la entrada `"./seccion"` del campo `exports` de `package.json`.
  - `IConfigPlantilla.section` pasa a ser de tipo `Route` (importado desde `@mr/core-network/route`).

### Migration

```ts
// Antes
import {Seccion, crearExactGET} from "@mr/core-templates/seccion";
import type {ISeccion, ISeccionOptions, ISeccionBuilderOptions, TSeccionRunner} from "@mr/core-templates/seccion";

// Ahora
import {Route, crearExactGET} from "@mr/core-network/route";
import type {IRoute, IRouteOptions, IRouteBuilderOptions, TRouteRunner} from "@mr/core-network/route";
```

---

