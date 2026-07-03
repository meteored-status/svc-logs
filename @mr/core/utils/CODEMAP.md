# CODEMAP — `@mr/core-utils`

Mapa técnico del workspace `@mr/core/utils/`.

## Árbol

```text
@mr/core/utils/
├─ src/
│  └─ config.ts   — IConfiguracion (interfaz raíz) + Configuracion<T> (clase base)
├─ README.md
├─ CODEMAP.md
├─ CHANGELOG.md
├─ package.json
└─ tsconfig.json
```

## Superficie pública

### `src/config.ts` → `@mr/core-utils/config`

| Símbolo | Tipo | Descripción |
|---------|------|-------------|
| `IConfiguracion` | `interface` | Marca de tipo raíz; sin propiedades. Restricción de `T` en `Configuracion<T>`. |
| `Configuracion<T extends IConfiguracion>` | `class` | Almacena `defecto: T` y `user: Partial<T>` como propiedades `protected`. Base de toda la jerarquía de configuración del monorepo. |

#### Propiedades de `Configuracion<T>`

| Propiedad | Tipo | Visibilidad | Descripción |
|-----------|------|:-----------:|-------------|
| `defecto` | `T` | `protected` | Valores de configuración por defecto. |
| `user` | `Partial<T>` | `protected` | Sobreescrituras parciales del usuario. |

## Consumidores directos

| Paquete | Alias de importación |
|---------|---------------------|
| `@mr/core-workload/config` | `ConfigGenerico` / `IConfigGenerico` |
| `@mr/core-workload/config/google` | `Configuracion` / `IConfiguracion` |
| `@mr/core-network/server/http/routes/group` | `Configuracion` (solo tipo) |
| `www-base/modules/utiles/config` | `ConfigGenerico` / `IConfigGenerico` |
| `services-comun/modules/send-task-system/utiles/config` | `ConfigGenerico` / `IConfigGenerico` |

