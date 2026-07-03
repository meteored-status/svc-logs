# CODEMAP - `@mr/core-templates`

Mapa tecnico del workspace `@mr/core/templates/`.

## Objetivo

Paquete base para construir componentes de plantillas web en el monorepo:

- Clase abstracta `Plantilla` (ciclo de render y agregacion de metadatos)
- Subclase `Componente` (dominios + expiracion configurable)
- Tipo `TDevice` (`pc` / `mv`)

## Arbol de modulos

```text
@mr/core/templates/
├─ src/
│  ├─ index.ts
│  ├─ componente.ts
│  └─ device.ts
├─ README.md
├─ CODEMAP.md
├─ package.json
└─ tsconfig.json
```

## Entrypoints (`package.json#exports`)

- `@mr/core-templates` -> `./src/index.ts`
- `@mr/core-templates/componente` -> `./src/componente.ts`
- `@mr/core-templates/device` -> `./src/device.ts`

## API publica

### `@mr/core-templates` (`src/index.ts`)

- `interface IConfigPlantilla`
  - `lang: Idioma`
  - `device: TDevice`
  - `section: Route`
  - `params: TParams`
- `interface ITemplateOptions`
  - `bloques?: Record<string, string>`
- `type FTemplate<T extends ITemplateOptions> = (opt: T) => string`
- `interface IPlantilla`
  - `render(): Promise<void>`
  - `expiracion?: Date`
  - `lastModified?: Date`
  - `cacheTags?: string[]`
- `abstract class Plantilla<P, T> implements IPlantilla`

#### `Plantilla` - estado y metodos clave

- Estado publico:
  - `contenido: string`
  - `expiracion?: Date`
  - `lastModified?: Date`
  - `cacheTags?: string[]`
- Estado interno:
  - `expiraciones: number[]`
  - `modificaciones: number[]`
- Metodos de composicion:
  - `loadModulo(modulop, {finish = true})`
  - `finishModulo(modulo)`
- Metodos de agregacion:
  - `addExpiracion(expiracion?)`
  - `addLastModified(last?)`
  - `addCacheTags(tags?)` (deduplica)
- Render:
  - `renderizar()` -> ejecuta `tmpl(await getParametros())`
  - `renderEjecutar()` -> calcula `contenido`, `expiracion` (min), `lastModified` (max)
  - `render()` (decorado con `@logRejection`)
- Errores:
  - `panic(e)` (decorado con `@logCall`) produce fallback, invalida cache y expira en el pasado
- Contrato abstracto:
  - `protected abstract getParametros(): Promise<P>`

### `@mr/core-templates/componente` (`src/componente.ts`)

- `interface IConfigComponente extends IConfigPlantilla`
  - `expires?: number`
  - `dominios: { cmp: string; services: string; www: string }`
- `type IOptions = ITemplateOptions` (re-export)
- `abstract class Componente<P, T = IConfigComponente> extends Plantilla<P, T>`

Comportamiento adicional:

- En constructor, si `config.expires` existe, se anade a `this.expiraciones`.

### `@mr/core-templates/device` (`src/device.ts`)

- `const enum TDevice`
  - `pc = "pc"`
  - `mv = "mv"`

## Flujo interno

### Render de un componente

```text
render()
  -> renderEjecutar()
     -> renderizar()
        -> tmpl(await getParametros())
     -> calcularExpiracion()   = min(expiraciones)
     -> calcularLastModified() = max(modificaciones)
```

### Composicion de submodulos

```text
loadModulo(Promise<Modulo>, {finish})
  -> await modulo
  -> if finish: finishModulo(modulo)
       -> modulo.render()
       -> addExpiracion(modulo.expiracion)
       -> addLastModified(modulo.lastModified)
       -> addCacheTags(modulo.cacheTags)
```

## Dependencias relevantes

- `@mr/core-network`
  - Tipos de contexto de request: `Route`, `TParams`
  - Tipo de idioma usado por `IConfigPlantilla`: `Idioma` (desde `@mr/core-network/server/http/i18n.ts`)
- `services-comun/modules/decorators/metodo`
  - Decoradores `logCall` y `logRejection`

## Nota de migracion

El antiguo modulo `Seccion` de este paquete se movio a `@mr/core-network/route` como `Route`.

## Mantenimiento

Si se amplian los entrypoints o se anaden nuevos modulos en `src/`, actualizar este CODEMAP con:

1. Arbol de modulos
2. Superficie exportada
3. Flujo de render/composicion
4. Dependencias cruzadas

