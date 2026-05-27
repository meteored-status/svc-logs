# `@mr/cli/manifest` — Manifest raíz del monorepo

Define el esquema TypeScript del fichero **`mrpack.json`** que se coloca en la raíz del monorepo.
Este fichero es leído por `yarn mrpack deploy` para controlar el proceso de compilación y despliegue global.

---

## Estructura de ficheros

```
manifest/
├── index.ts          # IManifest · Manifest (raíz)
└── deploy/
    ├── index.ts      # IManifestDeployment · ManifestDeployment
    ├── build.ts      # IManifestDeploymentBuild · ManifestDeploymentBuild
    └── run.ts        # IManifestDeploymentRun · ManifestDeploymentRun
```

---

## Esquema JSON (`mrpack.json`)

```json
{
    "deploy": {
        "build": {
            "enabled": true,
            "force": false
        },
        "run": {
            "enabled": true,
            "latest": false
        }
    }
}
```

Todos los campos son **opcionales**. Si el fichero no existe o un campo se omite se aplican los valores por defecto indicados arriba.

---

## Tipos

### `IManifest`

> `manifest/index.ts`

Raíz del fichero `mrpack.json`.

| Propiedad | Tipo | Por defecto | Descripción |
|-----------|------|-------------|-------------|
| `deploy` | `IManifestDeployment` | *(ver sección)* | Parámetros de compilación y despliegue. |

---

### `IManifestDeployment`

> `manifest/deploy/index.ts`

Bloque `deploy` del manifest raíz.

| Propiedad | Tipo | Por defecto | Descripción |
|-----------|------|-------------|-------------|
| `build` | `IManifestDeploymentBuild` | *(ver sección)* | Parámetros de la fase de compilación. |
| `run`   | `IManifestDeploymentRun`   | *(ver sección)* | Parámetros de la fase de despliegue.  |

---

### `IManifestDeploymentBuild`

> `manifest/deploy/build.ts`

Controla si los workspaces se compilan durante el despliegue.

| Propiedad | Tipo | Por defecto | Descripción |
|-----------|------|-------------|-------------|
| `enabled` | `boolean` | `true`  | Si `false`, se omite la compilación de todos los workspaces. |
| `force`   | `boolean` | `false` | Si `true`, se genera una nueva versión aunque el hash de los artefactos no haya cambiado. |

#### Variables de entorno

| Variable | Propiedad afectada | Valores |
|----------|--------------------|---------|
| `_GENERAR`        | `build.enabled` | `"true"` / `"1"` → `true`; `"false"` / `"0"` → `false` |
| `_GENERAR_FORZAR` | `build.force`   | `"true"` / `"1"` → `true`; cualquier otro → `false`     |

---

### `IManifestDeploymentRun`

> `manifest/deploy/run.ts`

Controla si se ejecuta el despliegue y qué versión se usa.

| Propiedad | Tipo | Por defecto | Descripción |
|-----------|------|-------------|-------------|
| `enabled` | `boolean` | `true`  | Si `false`, se omite la fase de despliegue. |
| `latest`  | `boolean` | `false` | Si `true`, se despliega la última versión generada aunque no se haya compilado en esta ejecución. Útil cuando se generó una versión nueva previamente pero no se desplegó. |

#### Variables de entorno

| Variable | Propiedad afectada | Valores |
|----------|--------------------|---------|
| `_DESPLEGAR`        | `run.enabled` | `"true"` / `"1"` → `true`; `"false"` / `"0"` → `false` |
| `_DESPLEGAR_LATEST` | `run.latest`  | `"true"` / `"1"` → `true`; cualquier otro → `false`     |

---

## Loader

El cargador `ManifestRootLoader` (`src/mrpack/clases/manifest/root/`) lee el fichero, aplica los valores por defecto para los campos ausentes, y — si se invoca con `load(true)` — sobreescribe los valores con las variables de entorno listadas arriba. Si el fichero no existe o su contenido difiere de los valores normalizados, se reescribe automáticamente en disco.

