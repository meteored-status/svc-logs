# `@mr/core-templates`

Paquete base para la construcción de componentes de plantilla web del monorepo.
Proporciona la clase abstracta `Plantilla` y su subclase `Componente`, y el tipo de dispositivo `TDevice`.

**Código fuente:** ver [`CODEMAP.md`](./CODEMAP.md).

> **Nota de migración:** el módulo de routing (`Seccion`) se trasladó a `@mr/core-network/route` y se renombró como `Route`. Ver [`@mr/core/network/route/README.md`](../network/route/README.md).

---

## Contenido

| Módulo | Entrada | Descripción |
|--------|---------|-------------|
| [Raíz](#plantilla) | `@mr/core-templates` | `Plantilla` — clase base de todos los componentes renderizables; `IPlantilla` — contrato mínimo para composición |
| [`componente`](#componente) | `@mr/core-templates/componente` | `Componente` — subclase de `Plantilla` con soporte de dominios y expiración |
| [`device`](#tdevice) | `@mr/core-templates/device` | `TDevice` — tipo de dispositivo del visitante (`pc` / `mv`) |

### Entrypoints públicos

Estos son los `exports` vigentes del paquete:

| Entrada | Archivo |
|---------|---------|
| `@mr/core-templates` | `src/index.ts` |
| `@mr/core-templates/componente` | `src/componente.ts` |
| `@mr/core-templates/device` | `src/device.ts` |

---

## `Plantilla`

**Entrada:** `@mr/core-templates`

Clase base abstracta para todos los componentes renderizables del sistema de plantillas.
Gestiona el ciclo de vida de renderizado, la propagación de fechas de expiración y la carga encadenada de sub-componentes.

```ts
import {Plantilla} from "@mr/core-templates";
import type {IPlantilla, IConfigPlantilla, ITemplateOptions, FTemplate} from "@mr/core-templates";
```

### Tipos exportados

#### `ITemplateOptions`

Opciones base que recibe la función de plantilla de cualquier componente.

| Propiedad | Tipo | Descripción |
|-----------|------|-------------|
| `bloques` | `Record<string, string> \| undefined` | Bloques de contenido dinámicos inyectables en la plantilla. |

Todos los `IOptions` concretos de cada componente extienden esta interfaz.

#### `FTemplate<T extends ITemplateOptions>`

```ts
export type FTemplate<T extends ITemplateOptions> = (opt: T) => string;
```

Función de plantilla pura: recibe las opciones del componente y devuelve HTML como `string`.

#### `IConfigPlantilla`

Configuración de contexto de petición que se pasa al construir cualquier `Plantilla`.

| Propiedad | Tipo | Descripción |
|-----------|------|-------------|
| `lang` | `Idioma` | Idioma activo de la petición. |
| `device` | `TDevice` | Tipo de dispositivo del visitante. |
| `section` | `Route` | Ruta de routing activa. Importar desde `@mr/core-network/route`. |
| `params` | `TParams` | Parámetros extraídos de la URL. Importar desde `@mr/core-network/route`. |

#### `IPlantilla`

Contrato mínimo que implementan todos los componentes. Permite componer componentes sin depender de los genéricos de `Plantilla`, evitando problemas de varianza en `FTemplate`.

| Miembro | Tipo | Descripción |
|---------|------|-------------|
| `render()` | `Promise<void>` | Ejecuta el renderizado y rellena `contenido`. |
| `expiracion` | `Date \| undefined` | Fecha de expiración calculada tras el render. |
| `lastModified` | `Date \| undefined` | Fecha de última modificación calculada tras el render. |
| `cacheTags` | `string[] \| undefined` | Etiquetas de caché asociadas al resultado renderizado. |

### Clase `Plantilla<P, T>`

```ts
abstract class Plantilla<
    P extends ITemplateOptions = ITemplateOptions,
    T extends IConfigPlantilla = IConfigPlantilla
> implements IPlantilla
```

| Parámetro | Descripción |
|-----------|-------------|
| `P` | Tipo de opciones de la función de plantilla. Extiende `ITemplateOptions`. |
| `T` | Tipo de la configuración de contexto. Extiende `IConfigPlantilla`. |

#### Propiedades públicas

| Propiedad | Tipo | Descripción |
|-----------|------|-------------|
| `contenido` | `string` | HTML renderizado. Vacío hasta llamar a `render()`. |
| `expiracion` | `Date \| undefined` | Fecha de expiración. Se calcula como el mínimo de las expiraciones acumuladas. |
| `lastModified` | `Date \| undefined` | Fecha de última modificación. Se calcula como el máximo de las modificaciones acumuladas. |
| `cacheTags` | `string[] \| undefined` | Etiquetas de caché acumuladas de este componente y sus sub-módulos. |

#### Métodos públicos

| Método | Descripción |
|--------|-------------|
| `render(): Promise<void>` | Renderiza el componente: ejecuta `getParametros()`, invoca la función de plantilla y calcula `expiracion` / `lastModified`. |
| `panic(e: unknown): void` | Fallback de error: rellena `contenido` con un mensaje de error, fuerza `expiracion` en el pasado y borra `lastModified` y `cacheTags`. |
| `toString(): string` | Devuelve `contenido`. Permite usar el componente directamente en interpolaciones de plantilla. |

#### Métodos protegidos

| Método | Descripción |
|--------|-------------|
| `loadModulo<K extends IPlantilla>(modulop: Promise<K>, {finish?}: {finish?: boolean}): Promise<K>` | Carga un sub-módulo, lo renderiza (si `finish = true`, por defecto) y propaga su expiración, `lastModified` y `cacheTags`. |
| `finishModulo<K extends IPlantilla>(modulo: K): Promise<K>` | Renderiza un módulo ya instanciado y propaga sus metadatos al padre. |
| `addExpiracion(expiracion?: Date): void` | Añade una fecha de expiración al pool del componente. |
| `addLastModified(last?: Date): void` | Añade una fecha de modificación al pool del componente. |
| `addCacheTags(tags?: string[]): void` | Añade etiquetas de caché (deduplica automáticamente). |
| `getParametros(): Promise<P>` | **Abstracto.** Debe devolver el objeto de opciones que se pasa a la función de plantilla. |

### Uso

```ts
import {Plantilla} from "@mr/core-templates";
import type {ITemplateOptions, IConfigPlantilla, FTemplate} from "@mr/core-templates";

interface IOptions extends ITemplateOptions {
    titulo: string;
    cuerpo: string;
}

const tmpl: FTemplate<IOptions> = ({titulo, cuerpo}) =>
    `<article><h1>${titulo}</h1><p>${cuerpo}</p></article>`;

class ComponenteArticulo extends Plantilla<IOptions> {
    public static async build(config: IConfigPlantilla): Promise<ComponenteArticulo> {
        return new ComponenteArticulo(config, tmpl);
    }

    protected constructor(config: IConfigPlantilla, tmpl: FTemplate<IOptions>) {
        super(config, tmpl);
    }

    protected async getParametros(): Promise<IOptions> {
        return {titulo: "Hola", cuerpo: "Mundo"};
    }
}

// Uso en un componente padre
const articulo = await this.loadModulo(ComponenteArticulo.build(this.config));
// articulo.contenido → "<article><h1>Hola</h1><p>Mundo</p></article>"
```

#### Cargar un sub-módulo sin renderizar de inmediato

```ts
// finish: false → solo instancia el módulo, no llama a render()
const gota = await this.loadModulo(ComponenteGota.build(this.config), {finish: false});
gota.addItem({nombre: "Madrid", url: "/es/madrid"});
await this.finishModulo(gota); // renderiza manualmente más tarde
```

---

## `Componente`

**Entrada:** `@mr/core-templates/componente`

Subclase de `Plantilla` que añade soporte de dominios de servicio y tiempo de expiración configurable.
Es la clase base habitual para todos los componentes de página del monorepo.

```ts
import {Componente} from "@mr/core-templates/componente";
import type {IConfigComponente, IOptions} from "@mr/core-templates/componente";
```

### `IConfigComponente`

Extiende `IConfigPlantilla` con los campos propios de un componente web.

| Propiedad | Tipo | Descripción |
|-----------|------|-------------|
| `expires` | `number \| undefined` | Tiempo de expiración en milisegundos desde ahora. Se añade automáticamente al pool de expiraciones. |
| `dominios.cmp` | `string` | Dominio del servicio CMP (gestión de consentimiento). |
| `dominios.services` | `string` | Dominio base de los servicios internos. |
| `dominios.www` | `string` | Dominio público principal (`www`). |

### `IOptions`

Re-exportación de `ITemplateOptions` para uso como tipo base de las opciones de cada componente concreto.

```ts
import type {IOptions} from "@mr/core-templates/componente";

interface IMisOpciones extends IOptions {
    titulo: string;
}
```

### Clase `Componente<P, T>`

```ts
abstract class Componente<
    P extends IOptions,
    T extends IConfigComponente = IConfigComponente
> extends Plantilla<P, T>
```

El único comportamiento añadido respecto a `Plantilla` es registrar `config.expires` en el pool de expiraciones durante la construcción.

### Uso

```ts
import {Componente} from "@mr/core-templates/componente";
import type {IConfigComponente, IOptions} from "@mr/core-templates/componente";
import type {FTemplate} from "@mr/core-templates";

interface IMisOpciones extends IOptions {
    titulo: string;
}

class MiComponente extends Componente<IMisOpciones> {
    public static async build(config: IConfigComponente): Promise<MiComponente> {
        return new MiComponente(config, tmpl);
    }

    protected constructor(config: IConfigComponente, tmpl: FTemplate<IMisOpciones>) {
        super(config, tmpl);
    }

    protected async getParametros(): Promise<IMisOpciones> {
        return {titulo: "Ejemplo"};
    }
}
```

---

## `TDevice`

**Entrada:** `@mr/core-templates/device`

Indica el tipo de dispositivo del visitante tal como lo detecta el servidor.

```ts
import {TDevice} from "@mr/core-templates/device";
```

```ts
const enum TDevice {
    pc = "pc",
    mv = "mv",
}
```

| Valor | Descripción |
|-------|-------------|
| `TDevice.pc` | Escritorio / navegador de sobremesa. |
| `TDevice.mv` | Móvil o tablet. |

Se propaga en `IConfigPlantilla.device` y está disponible en `getParametros()` a través de `this.config.device`.

---

## Relación entre los módulos

```
IConfigPlantilla ──────────────────┐
ITemplateOptions ───────┐          │
FTemplate<P> ──────┐    │          │
                   ▼    ▼          ▼
             Plantilla<P, T> ◄─ implements ─ IPlantilla
                   ▲
                   │ extends
             Componente<P, T>
                   ▲
                   │ extends
             (componentes concretos del proyecto)
```

- `IPlantilla` es la interfaz ligera que usa `loadModulo` internamente para componer componentes sin problemas de varianza de tipos función.
- `Route` (de `@mr/core-network/route`) se inyecta como `config.section` en `IConfigPlantilla`.
- `TDevice` se inyecta como `config.device` y puede propagarse a las opciones de plantilla.
