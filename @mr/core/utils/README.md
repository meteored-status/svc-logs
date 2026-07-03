# `@mr/core-utils`

Paquete de utilidades base del monorepo. Proporciona las clases e interfaces
primitivas de configuración sobre las que se construyen todas las jerarquías de
configuración de los servicios.

**Código fuente:** ver [`CODEMAP.md`](./CODEMAP.md).

---

## Contenido

| Módulo | Entrada | Descripción |
|--------|---------|-------------|
| [Configuración base](#configuración-base) | `@mr/core-utils/config` | `IConfiguracion` + `Configuracion<T>` — raíz de todas las configuraciones |

---

## Configuración base

**Entrada:** `@mr/core-utils/config`

```ts
import {Configuracion} from "@mr/core-utils/config";
import type {IConfiguracion} from "@mr/core-utils/config";
```

Define la interfaz vacía `IConfiguracion` (marca de tipo) y la clase genérica
`Configuracion<T>` que almacena los valores por defecto y las sobreescrituras del usuario
en propiedades protegidas `defecto` y `user`.

### `IConfiguracion`

Interfaz raíz sin propiedades propias. Actúa como restricción de tipo para el parámetro
genérico `T` de `Configuracion<T>`. Cualquier objeto plano vacío la satisface estructuralmente.

### `Configuracion<T extends IConfiguracion>`

Clase base genérica. Las subclases la extienden para añadir propiedades de configuración
concretas, aplicando la fusión `user ?? defecto` en sus propios constructores.

| Propiedad | Visibilidad | Descripción |
|-----------|:-----------:|-------------|
| `defecto` | `protected` | Valores por defecto proporcionados en tiempo de construcción. |
| `user` | `protected` | Sobreescrituras parciales leídas del fichero de configuración. |

### Patrón de extensión

```ts
interface IMyConfig extends IConfiguracion {
    timeout: number;
    retries: number;
}

class MyConfig extends Configuracion<IMyConfig> {
    public readonly timeout: number;
    public readonly retries: number;

    public constructor(defecto: IMyConfig, user: Partial<IMyConfig>) {
        super(defecto, user);
        this.timeout = user.timeout ?? defecto.timeout;
        this.retries = user.retries ?? defecto.retries;
    }
}
```

### Jerarquía de configuración en el monorepo

```
Configuracion<T>                        (@mr/core-utils/config)
  └─ Configuracion<T>                   (@mr/core-workload/config)          añade: pod
       └─ ConfiguracionNet<T>           (@mr/core-workload/config/net)      añade: net
            └─ Configuracion<T>         (services-comun-meteored/config)    inyecta SERVICES
                 └─ Configuracion<T>    (www-base/modules/utiles/config)    añade: cache, resources, vienty, google
                      └─ Configuracion  (services/*/modules/utiles/config)  configuración del servicio concreto
```

---

## Changelog

Consulta [`CHANGELOG.md`](./CHANGELOG.md) para el historial de cambios del paquete.

