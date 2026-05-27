# `@mr/cli` — Herramientas de línea de comandos

CLI del monorepo `web-www`. Proporciona dos ejecutables:

| Comando | Descripción |
|---------|-------------|
| `mrpack` | Gestión del ciclo de vida del proyecto (compilación, despliegue, frameworks…) |
| `mrlang` | Utilidades de internacionalización |

---

## `mrpack`

```
yarn mrpack <modulo> [opciones]
```

### Módulos disponibles

| Módulo | Descripción |
|--------|-------------|
| [`devel`](#devel) | Compila y/o ejecuta los workspaces en modo desarrollo (con watch) |
| [`deploy`](#deploy) | Compila todos los workspaces para un entorno de producción o test |
| [`framework`](#framework) | Operaciones sobre los frameworks compartidos (añadir, actualizar, resetear, enviar…) |
| [`init`](#init) | Inicializa la configuración del proyecto |
| [`update`](#update) | Actualiza las librerías del proyecto |
| [`autodoc`](#autodoc) | Genera la documentación automática del proyecto |

> Usa `-h` / `--help` en cualquier módulo para ver su ayuda específica:
> ```
> yarn mrpack devel --help
> ```

---

### `devel`

Inicia la compilación y/o ejecución de los workspaces habilitados en modo desarrollo.
Activa el modo **watch** de rspack: recompila automáticamente al detectar cambios.

```
yarn mrpack devel [opciones] [adicional]
```

| Opción | Descripción |
|--------|-------------|
| `-c` / `--compilar` | Compila los workspaces habilitados |
| `-e` / `--ejecutar` | Ejecuta los workspaces habilitados |
| `-f` / `--forzar` | Fuerza la operación en **todos** los workspaces (incluso los deshabilitados) |

#### `config.workspaces.json`

El fichero `config.workspaces.json` en la raíz del monorepo controla qué workspaces se
compilan/ejecutan en modo desarrollo. Se genera y actualiza con `mrpack init`.

Incluye también la propiedad `framework.updates` que controla con qué frecuencia se
**preseleccionan** los paquetes de framework con update disponible al arrancar `devel -c`:

| Valor | Comportamiento |
|-------|----------------|
| `"all"` *(por defecto)* | Todos los paquetes con update quedan preseleccionados en `actualizar` |
| `"daily"` | Solo se preselecciona `actualizar` si la versión instalada tiene **1 día o más** de antigüedad |
| `"weekly"` | Igual que `daily` pero con umbral de **7 días** |

En los modos `daily` y `weekly`, si la versión local no aparece en el historial de `stable.txt`
(publicada hace más de 7 días), se preselecciona `actualizar` igualmente. Un valor no reconocido
se normaliza automáticamente a `"all"`.

Ejemplo de `config.workspaces.json`:

```json
{
  "devel":  { "available": ["www-frontend"], "disabled": ["www-legacy"] },
  "packd":  { "available": ["www-frontend", "www-legacy"], "disabled": [] },
  "i18n":   true,
  "services": {},
  "framework": {
    "updates": "daily"
  }
}
```

#### Ejemplos

```bash
# Solo compilar los workspaces habilitados
yarn mrpack devel -c

# Compilar y ejecutar todos los workspaces
yarn mrpack devel -c -e -f

# Solo ejecutar los workspaces habilitados (sin recompilar)
yarn mrpack devel -e
```

---

### `deploy`

Compila todos los workspaces para un entorno de producción o test.
No activa watch; produce los bundles finales optimizados.

```
yarn mrpack deploy --env=<entorno>
```

| Opción | Valores | Descripción |
|--------|---------|-------------|
| `--env` | `produccion` \| `test` | Entorno de compilación (obligatorio) |

#### Ejemplos

```bash
# Compilar para producción
yarn mrpack deploy --env=produccion

# Compilar para test/staging
yarn mrpack deploy --env=test
```

---

### `framework`

Gestiona los frameworks compartidos entre proyectos del monorepo.
Los frameworks son paquetes de código reutilizable almacenados en un bucket de GCS.

```
yarn mrpack framework [opciones]
```

| Opción | Descripción |
|--------|-------------|
| `-u` / `--update` | Abre la tabla interactiva filtrada a los paquetes con update disponible, preseleccionados en `actualizar`. |
| `-r` / `--reset`  | Abre la tabla interactiva filtrada a los paquetes instalados, preseleccionados en `resetear`. |
| `-s` / `--send`   | Abre la tabla interactiva filtrada a los paquetes con cambios locales, preseleccionados en `enviar` / `actualizar+enviar`. |
| `-y` / `--yes`    | Junto con `-u`, `-r` o `-s`: **omite la tabla** y aplica la acción directamente sobre todos los paquetes sin interacción. |

Sin opciones abre un **gestor interactivo** con la tabla completa de paquetes
disponibles: `@mr/cli`, `@mr/core/*`, `@mr/user/*` y los paquetes legacy `framework/services-*`
ya instalados.

> **Nota:** al arrancar el modo de desarrollo (`yarn mrpack devel -c`) también se comprueba si
> hay actualizaciones de frameworks. Si las hay, aparece la misma tabla interactiva en modo
> `--update` con un **timeout de 5 segundos**: si no se interactúa, se confirma la selección
> automáticamente. La preselección de cada paquete depende de la propiedad `framework.updates`
> de `config.workspaces.json` (ver sección [`devel`](#devel)); con `"all"` (por defecto) todos
> los paquetes con update quedan preseleccionados en `actualizar`.

#### Modos de tabla

Cada flag abre una vista restringida de la tabla con solo las columnas y paquetes relevantes:

| Modo | Paquetes mostrados | Acciones disponibles | Preselección |
|------|--------------------|---------------------|--------------|
| Sin flag (completo) | Todos | `nada`, `instalar/actualizar`, `desinstalar`, `resetear`, `enviar` | `actualizar` si hay update remoto; `nada` en otro caso |
| `--update` | Todos | `nada`, `actualizar` | `actualizar` para los que tienen update |
| `--reset` | Solo instalados | `nada`, `resetear` | `resetear` |
| `--send` | Solo con cambios locales | `nada`, `enviar` / `actualizar+enviar` | `enviar` o `actualizar+enviar` según corresponda |

#### Columnas de la tabla

| Columna | Descripción |
|---------|-------------|
| `tipo` | `""` para `@mr/cli`, `core`, `user` o `legacy` |
| `nombre` | Nombre corto del paquete (sin tipo) |
| `instalada` | Versión instalada localmente, o `no instalado` |
| `disponible` | Versión más reciente en GCS, o `desconocido` |
| `acción` | Selector de radio buttons para la acción a aplicar |
| `enviar` | Solo aparece si algún paquete tiene cambios locales pendientes de publicar. La celda se muestra **en verde** cuando el paquete puede enviarse directamente (sin update remoto pendiente), o **en cyan** con el texto `"actualizar+enviar"` cuando hay un update remoto pendiente (proceso de dos pasos). Si ningún paquete tiene cambios locales, la columna no aparece. |

#### Acciones disponibles por paquete

Las opciones se muestran como radio buttons en orden fijo. Si una opción no aplica a un
paquete, se reserva el hueco para mantener la alineación visual de columnas.

| Acción | Cuándo aparece |
|--------|----------------|
| `nada` | Siempre |
| `instalar` / `actualizar` | Solo si hay versión remota disponible (y es más reciente). La columna completa se oculta si ningún paquete la tiene. |
| `desinstalar` | Solo si está instalado y no es `@mr/cli` ni `legacy` |
| `resetear` | Solo si está instalado |
| `enviar` | Solo si hay cambios locales y **no** hay update remoto pendiente. Se muestra en **verde**. |
| `actualizar+enviar` | Si hay cambios locales **y** un update remoto pendiente. Proceso de dos pasos: primero aplica el update y, si el merge no genera conflictos, envía los cambios. Se muestra en **cyan**. |

#### Detección de cambios locales

El gestor compara el hash del árbol de ficheros local con el hash almacenado
en el ZIP estable de GCS (`stable-${version}.zip`), exactamente igual que hace
`mrpack upload` antes de subir. Esta comprobación se realiza en paralelo durante
la carga inicial y no modifica ningún fichero local permanentemente.

Si el ZIP no existe en GCS (paquete nuevo o nunca publicado), se considera que
hay cambios pendientes (`enviar` disponible por defecto).

El hash de cada fichero `.ts` se calcula **sobre el cuerpo del fichero sin el bloque
de autoría**, de modo que cambiar únicamente la cabecera (fecha, versión…) no genera
un `send` innecesario.

#### Ficheros marcadores

Dentro de cada directorio de un paquete se pueden colocar ficheros especiales que
ajustan el comportamiento del empaquetado y la detección de cambios:

| Fichero | Efecto |
|---------|--------|
| `.mr-ignore` | Las entradas listadas se excluyen completamente del paquete (no se empaquetan ni contribuyen al hash). |
| `.mr-bin` | Las entradas listadas se tratan como binarias: al recibir un update se sobreescriben directamente sin intentar un merge 3-way. |
| `.mr-nohash` | Las entradas listadas se incluyen en el ZIP al publicar, pero su hash **no contribuye** al hash del directorio padre. Los cambios en esos hijos no disparan la detección de cambios del paquete. |

**Ejemplo de `.mr-nohash`:** para que los cambios en `bin/min/` no generen una nueva
versión del paquete, crear el fichero `bin/.mr-nohash` con el contenido:

```
min
```

#### Bloque de autoría

Al publicar una nueva versión, cada fichero `.ts` modificado recibe al inicio del
fichero un bloque de autoría con los siguientes campos:

```typescript
/**
 * Editor: <nombre-autor>
 * Fecha: <fecha-UTC>
 * Hash: <md5-del-cuerpo>
 * Versión: <YYYY.MM.DD+N-autor>
 * Anterior: <versión-publicada-anteriormente>  ← solo si existía una versión previa
 */
```

| Campo | Descripción |
|-------|-------------|
| `Editor` | Nombre git del autor que realizó el `send` |
| `Fecha` | Fecha y hora UTC del momento de publicación |
| `Hash` | MD5 del cuerpo del fichero sin el bloque de autoría (sirve para verificar integridad) |
| `Versión` | Número de versión del paquete en que se publicó este cambio (formato completo `YYYY.MM.DD+N-autor`) |
| `Anterior` | Versión que figuraba en `Versión` en la publicación anterior del mismo fichero; permite trazar el historial directamente en el fuente |

#### Verificación de versión antes de enviar

Justo antes de aplicar cualquier acción de envío (`enviar` o `actualizar+enviar`),
el gestor consulta de nuevo la versión remota actual de cada paquete afectado.
Si la versión cambió desde que se cargó la tabla (alguien más publicó mientras),
se muestra un aviso `⚠` y la tabla se recarga para que el usuario vuelva a elegir.

#### Logs de actualización

Cada vez que se aplica un `applyUpdate` (acciones `instalar`, `actualizar`, `resetear` o
`actualizar+enviar`), el resultado se persiste en:

```
tmp/log/<nombre-seguro>.pull.md
```

donde `<nombre-seguro>` es el nombre npm del paquete con los caracteres `@` y `/` sustituidos
por `-` y sin guiones iniciales (por ejemplo `mr-core-dev.pull.md`).

El fichero se sobreescribe en cada actualización con formato Markdown y enlaces
clickables a los ficheros afectados:

```markdown
# Update @mr/core-dev

- Fecha: 2026-05-14 10:30:00 UTC
- Versión local: 2026.5.1+1
- Versión remota: 2026.5.14+1

## Archivos

| Estado | Archivo |
|---|---|
| OK | [`src/index.ts`](../../@mr/core/dev/src/index.ts) |
| OK | [`package.json`](../../@mr/core/dev/package.json) |
| Error | [`src/conflicto.ts`](../../@mr/core/dev/src/conflicto.ts) |

## Salida del proceso

<salida adicional del proceso>
```

Si hay conflictos de merge en algún fichero, la línea de progreso del paquete muestra
`[CONFLICTO]` (en morado) en lugar de `[OK       ]`. Una vez terminadas todas las
actualizaciones en paralelo, se imprimen los avisos con la ruta al fichero de log:

Además, `mrpack` mantiene automáticamente un índice en:

```
tmp/log/index.md
```

Este índice incluye enlaces clickables a todos los logs `.pull.md` y `.push.md` disponibles
en `tmp/log/` para abrirlos rápidamente desde el entorno.

#### Proceso `actualizar+enviar`

Cuando se selecciona esta acción para un paquete:
1. Se aplica el update remoto con mezcla 3-way (`applyUpdate`).
2. Si el merge **no** genera conflictos → se envían los cambios locales (`push`).
3. Si el merge **genera conflictos** → se muestra un aviso con los ficheros afectados
   y **no** se realiza el push. El usuario debe resolver los conflictos manualmente
   antes de volver a enviar. Los ficheros con conflictos quedan registrados en el log.

#### Navegación

| Tecla | Modo completo | Modo `--update` | Modo `--reset` | Modo `--send` |
|-------|---------------|-----------------|----------------|---------------|
| `↑` / `↓` | Moverse entre paquetes | ✓ | ✓ | ✓ |
| `←` / `→` | Cambiar acción del paquete activo | ✓ | ✓ | ✓ |
| `Intro` | Aplicar todos los cambios | ✓ | ✓ | ✓ |
| `Esc` / `Ctrl+C` | Cancelar sin cambios | ✓ | ✓ | ✓ |
| `n` | Seleccionar **nada** en todos | ✓ | ✓ | ✓ |
| `a` | Seleccionar **actualizar** en todos | ✓ | ✓ | — |
| `r` | Seleccionar **resetear** en todos | ✓ | — | ✓ | — |
| `e` | Seleccionar **enviar** en todos | ✓ | — | — | ✓ |

#### Tipos de paquete y ubicación

| Formato npm | Tipo | Directorio local |
|-------------|------|------------------|
| `@mr/cli` | *(cli)* | `@mr/cli/` |
| `@mr/core-<name>` | `core` | `@mr/core/<name>/` |
| `@mr/user-<name>` | `user` | `@mr/user/<name>/` |
| `services-<name>` | `legacy` | `framework/services-<name>/` |

> Los paquetes `legacy` solo aparecen en el listado si ya están instalados localmente.
> No se puede desinstalar ni `@mr/cli` ni paquetes `legacy` desde este gestor.

#### Ejemplos

```bash
# Abrir el gestor interactivo completo
yarn mrpack framework

# Elegir qué paquetes actualizar (tabla filtrada, preseleccionados)
yarn mrpack framework --update

# Actualizar todos sin preguntar
yarn mrpack framework --update --yes

# Elegir qué paquetes resetear
yarn mrpack framework --reset

# Resetear todos sin preguntar
yarn mrpack framework --reset --yes

# Elegir qué paquetes enviar
yarn mrpack framework --send

# Enviar todos los paquetes con cambios sin preguntar
yarn mrpack framework --send --yes
```

---

### `init`

Inicializa la configuración del proyecto. Crea o regenera los ficheros de configuración
necesarios para que el monorepo funcione correctamente.

Entre otras acciones:
- Descarga automáticamente los paquetes `@mr/core/*` ausentes.
- Por cada workspace en `services/`, `packages/`, `jobs/` y `cronjobs/`, propaga de forma
  recursiva las `dependencies` **y** `optionalDependencies` de producción de todos sus
  `devDependencies` de tipo `@mr/*` (incluidas las dependencias transitivas), resolviendo
  conflictos de versión eligiendo siempre la más reciente.
- `bufferutil` se elimina de `dependencies` si estuviera presente (por propagación transitiva
  o por declaración previa), ya que este módulo nativo solo debe aparecer en `optionalDependencies`.
- Regenera el `.yarnrc.yml` con claves ordenadas alfabéticamente y una línea en blanco entre
  cada campo de nivel raíz. Garantiza la presencia de las siguientes opciones de seguridad:

  | Opción | Valor  | Descripción |
  |--------|--------|-------------|
  | `checksumBehavior` | `la`   | Aborta si el checksum de un paquete no coincide |
  | `enableHardenedMode` | `true` | Verifica integridad y bloquea ataques de confusión de dependencias |
  | `enableStrictSsl` | `true` | Valida certificados SSL en todas las descargas |
  | `npmMinimalAgeGate` | `1440` | Rechaza paquetes publicados hace menos de 24 h |
  | `unsafeHttpWhitelist` | `[]`   | Bloquea cualquier descarga por HTTP sin cifrar |

```
yarn mrpack init
```

---

### `update`

Inicializa la configuración del proyecto y actualiza las librerías (`yarn install` + configuración).

```
yarn mrpack update
```

> **Tras ejecutar `yarn mrpack update`** se recomienda aplicar los parches de migración
> para corregir imports deprecados de forma automática:
>
> ```bash
> yarn run patch:apply
> ```
>
> Consulta [`@mr/core/dev/patches/README.md`](../@mr/core/dev/patches/README.md) para
> la documentación completa del sistema de parches.

---

### `autodoc`

Genera la documentación automática del proyecto a partir del código fuente.

```
yarn mrpack autodoc --env=<entorno>
```

| Opción | Descripción |
|--------|-------------|
| `--env` | Entorno para el que generar la documentación |

---

## Referencia rápida

| Tarea | Comando |
|-------|---------|
| Compilar workspaces habilitados | `yarn mrpack devel -c` |
| Compilar **todos** los workspaces | `yarn mrpack devel -c -f` |
| Compilar y ejecutar workspaces habilitados | `yarn mrpack devel -c -e` |
| Compilar y ejecutar **todos** los workspaces | `yarn mrpack devel -c -e -f` |
| Solo ejecutar (sin recompilar) | `yarn mrpack devel -e` |
| Build de producción | `yarn mrpack deploy --env=produccion` |
| Build de test/staging | `yarn mrpack deploy --env=test` |
| Gestor interactivo de frameworks | `yarn mrpack framework` |
| Elegir qué frameworks actualizar | `yarn mrpack framework --update` |
| Actualizar frameworks sin interacción | `yarn mrpack framework --update --yes` |
| Elegir qué frameworks resetear | `yarn mrpack framework --reset` |
| Resetear frameworks sin interacción | `yarn mrpack framework --reset --yes` |
| Elegir qué frameworks enviar | `yarn mrpack framework --send` |
| Enviar frameworks con cambios sin interacción | `yarn mrpack framework --send --yes` |
| Instalar nuevo framework | `yarn mrpack framework` → acción `instalar` |
| Actualizar librerías | `yarn mrpack update` |
| **Aplicar parches de migración** | `yarn run patch:apply` |
| Comprobar parches pendientes (CI) | `yarn run patch` |
| Inicializar proyecto | `yarn mrpack init` |

---

## Changelog

Consulta [`CHANGELOG.md`](./CHANGELOG.md) para el historial de cambios del paquete.

---

## Sub-módulos documentados

| Módulo | Documentación |
|--------|---------------|
| Manifest raíz (`mrpack.json` del monorepo) | [`manifest/README.md`](./manifest/README.md) |

---

## Estructura interna — `clases/framework/`

El módulo de gestión de frameworks está dividido en tres ficheros bajo `src/mrpack/clases/framework/`:

| Fichero | Responsabilidad |
|---------|-----------------|
| `cliente.ts` | Operaciones de cliente: `add`, `remove`, `checkCliente`, `recompilarCliente(basedir, hash, reiniciar?)`, `getAutor`, `getClienteHash`, `getClienteMD5`, `pullPackage` |
| `gestor.ts` | Todo el ciclo de vida de paquetes: `gestionar(basedir, reiniciar?)`, `actualizarTodo(basedir, forzar?, reiniciar?)`, `enviarTodo(basedir, forzar?, reiniciar?)`, `resetearTodo(basedir, forzar?, reiniciar?)`; `GestorTabla`, `construirInfoPaquetes`, `ejecutarAcciones(basedir, infos, acciones, reiniciar?)`; `const enum Accion`, `type GestorModo`, `IPaqueteGestion` |
| `index.ts` | Barrel que re-exporta todo lo anterior |

### `GestorTabla`

La tabla interactiva soporta cuatro modos configurables en el constructor:

| Parámetro | Tipo | Por defecto | Descripción |
|-----------|------|-------------|-------------|
| `infos` | `IPaqueteGestion[]` | — | Lista de paquetes a mostrar |
| `modo` | `GestorModo` | `"todos"` | Modo de operación (ver tabla de modos) |

**Modos disponibles (`GestorModo`):**

| Valor | Acciones disponibles | Preselección | Atajos de teclado |
|-------|---------------------|--------------|-------------------|
| `"todos"` | `nada`, `instalar/actualizar`, `desinstalar`, `resetear`, `enviar` | `actualizar` si hay update | `n`, `a`, `r`, `e` |
| `"update"` | `nada`, `actualizar` | `actualizar` si hay update | `n`, `a` |
| `"reset"` | `nada`, `resetear` | `resetear` | `n`, `r` |
| `"send"` | `nada`, `enviar` / `actualizar+enviar` | `enviar` o `actualizar+enviar` | `n`, `e` |

El método `run(autoConfirmMs?)` acepta un timeout de auto-confirmación en milisegundos:
- Sin parámetro → espera indefinidamente (modo `gestionar`).
- Con valor (e.g. `5000`) → muestra una cuenta atrás en la tabla y confirma automáticamente al expirar; el primer keypress cancela el timer.

Los **slots** de acciones se pre-calculan en el constructor para evitar allocaciones durante el renderizado.

### `ejecutarAcciones`

Función interna que aplica un array de acciones sobre los paquetes cargados. Características:
- **Despacho O(n)**: un único bucle `switch` en lugar de 6 pases `filter+map`.
- **`getAutor()` único**: el nombre del autor git se obtiene una sola vez, solo si hay algún paquete que enviar.
- **Paralelización total**: instalaciones+actualizaciones, resets, desinstalaciones y envíos corren con `Promise.all`.
- **Consola reciclada en resets**: `setupConsolaParaUpdate` se invoca antes del bloque de reset, igual que en instalaciones, actualizaciones y envíos, de modo que cada paquete actualiza su propia línea en lugar de crear líneas nuevas.
- **Estado `[CONFLICTO]`**: cuando el merge 3-way produce conflictos, la línea de progreso muestra `[CONFLICTO]` en morado en lugar de `[ERROR    ]`.
- **Avisos diferidos**: los mensajes de conflicto/error ya no se imprimen dentro del `Promise.all` (lo que descolocaba las líneas de progreso). Se acumulan en un array `avisos[]` y se muestran todos juntos al finalizar todas las acciones.
- **Parámetro `reiniciar`** (`true` por defecto): controla si se permite el reinicio automático del proceso tras recompilar `@mr/cli`. Se pasa `false` desde `mrpack framework` para evitar el bucle de reinicio infinito cuando el CLI se actualiza con conflictos.

Los imports externos (`from "./framework"`) resuelven automáticamente a `framework/index.ts`.

### `initYarnRC` (en `clases/init.ts`)

Regenera el `.yarnrc.yml` del monorepo usando `js-yaml`:
- Parsea el fichero existente a un objeto `IYarnRC` tipado con `yamlLoad`.
- Añade o actualiza los campos de seguridad requeridos.
- Elimina las `packageExtensions` obsoletas y añade las nuevas.
- Serializa con `yamlDump({ sortKeys: true, lineWidth: -1 })` y añade una línea en blanco
  entre cada clave de nivel raíz para mejorar la legibilidad.

