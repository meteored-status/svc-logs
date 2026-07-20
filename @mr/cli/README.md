# `@mr/cli` — Herramientas de línea de comandos

CLI del monorepo `web-www`. Proporciona dos ejecutables:

| Comando | Descripción |
|---------|-------------|
| `mrpack` | Gestión del ciclo de vida del proyecto (compilación, despliegue, frameworks…) |
| `mrlang` | Utilidades de internacionalización |

> **Código fuente:** ver [`src/mrpack/CODEMAP.md`](src/mrpack/CODEMAP.md) para el mapa completo de clases, funciones exportadas y grafo de dependencias del módulo `mrpack`.

---

## `mrpack`

```
yarn mrpack <modulo> [opciones]
```

### Módulos disponibles

| Módulo | Descripción |
|--------|-------------|
| [`devel`](#devel) | Compila y/o ejecuta los workspaces en modo desarrollo (watch opcional con `-w`) |
| [`deploy`](#deploy) | Compila todos los workspaces para un entorno de producción o test |
| [`config`](#config) | Gestión interactiva de `config.workspaces.json` |
| [`framework`](#framework) | Operaciones sobre los frameworks compartidos (añadir, actualizar, resetear, enviar…) |
| [`init`](#init) | Inicializa la configuración del proyecto |
| [`update`](#update) | Actualiza las librerías del proyecto |
| [`autodoc`](#autodoc) | Genera la documentación automática del proyecto |

> Usa `-h` / `--help` en cualquier módulo para ver su ayuda específica:
> ```
> yarn mrpack devel --help
> ```

### Formato de logs

Cada línea de log de `mrpack` se muestra como `[hora][TIPO][etiqueta]`, con los corchetes
`[ ]` coloreados en morado. La etiqueta representa el anidamiento lógico de la operación en
curso: al entrar en una subsección (p.ej. comprobar el cliente dentro de `init`, o Yarn
dentro de esa comprobación) la etiqueta compone el camino completo separado por espacios,
sin depender de la indentación de `console.group()`:

```
[11:00:12][ENTORNO ][init] Inicializando
[11:00:12][ENTORNO ][init cliente] Comprobando cliente
[11:00:12][ENTORNO ][init cliente yarn] Reinstalando dependencias
```

Si una llamada usa la misma etiqueta que la sección en la que ya está anidada, no se
duplica (p.ej. varias líneas seguidas dentro de `yarn` no producen `"yarn yarn"`).

---

### `devel`

Inicia la compilación y/o ejecución de los workspaces habilitados en modo desarrollo.

Por defecto (sin `-w`) los compiladores (`tsc`, `esbuild`, `rspack`) compilan **una única vez**
y el proceso termina en cuanto todos han finalizado. Con `-w` se activa el modo **watch** del
bundler configurado (`rspack` o `esbuild`): recompila automáticamente al detectar cambios y el
proceso permanece en ejecución.

```
yarn mrpack devel [opciones] [adicional]
```

| Opción | Descripción |
|--------|-------------|
| `-c` / `--compilar` | Compila los workspaces habilitados |
| `-e` / `--ejecutar` | Ejecuta los workspaces habilitados |
| `-f` / `--forzar` | Fuerza la operación en **todos** los workspaces (incluso los deshabilitados) |
| `-w` / `--watch` | Activa el modo watch: los compiladores quedan observando cambios y el proceso no termina por sí solo |

> **Patches automáticos:** al arrancar con `-c`, `mrpack devel` ejecuta siempre
> `yarn run patch:apply` antes de iniciar los compiladores, independientemente de si
> se han actualizado frameworks o no. Si no hay patches pendientes el comando finaliza
> de inmediato. Consulta [`@mr/core/dev/patches/README.md`](../@mr/core/dev/patches/README.md)
> para la documentación completa del sistema de parches.

#### `config.workspaces.json`

El fichero `config.workspaces.json` en la raíz del monorepo controla qué workspaces se
compilan/ejecutan en modo desarrollo. Se genera y actualiza con `mrpack init`.

`workspaces.i18n` (primera propiedad, solo presente si el proyecto tiene workspace `i18n`)
controla la generación de internacionalización:

| Flag | Significado |
|------|-------------|
| `enabled` | `true` (o ausente) = al arrancar la compilación se inicia el paso de generación de i18n; `false` = se omite por completo |
| `watch` | `true` = la generación de i18n permanece observando cambios en los ficheros de traducción del workspace; `false` (o ausente) = genera una única vez |

El resto de la propiedad `workspaces` agrupa los demás workspaces del proyecto según su
`deploy.type` (`browser`, `cronjobs`, `jobs`, `services`; ver
[`@mr/core/dev/manifest/README.md`](../@mr/core/dev/manifest/README.md) para
`ManifestDeploymentKind`), **no** según el directorio físico que los contiene. Cada
workspace tiene dos flags booleanos opcionales:

| Flag | Significado | Solo aplica a |
|------|-------------|---------------|
| `compilar` | `true` (o ausente) = se compila; `false` = no se compila | workspaces compilables (`deploy.runtime !== "php"`) |
| `ejecutar` | `true` (o ausente) = se ejecuta en modo devel; `false` = no se ejecuta | workspaces ejecutables (`deploy.runtime === "node"`) |

Todas las propiedades dentro de `workspaces` (`i18n`, los 4 grupos, y `ejecutar`/`compilar`
de cada workspace) son opcionales: un grupo sin workspaces gestionables, o un flag no
aplicable a un workspace concreto, simplemente se omiten.

La propiedad `framework` agrupa la configuración relativa a los paquetes framework:

| Flag | Significado |
|------|-------------|
| `patch` | Último patch aplicado (`RXXX`) por `yarn run patch:apply` (ver [`@mr/core/dev/patches/README.md`](../@mr/core/dev/patches/README.md)). Ausente **o cadena vacía `""`** = ningún patch registrado; `patch:apply` reprocesa todas las reglas desde cero. |
| `updates` | Frecuencia de **preselección** de paquetes de framework con update disponible al arrancar `devel -c` (tabla siguiente). |

| Valor de `updates` | Comportamiento |
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
  "workspaces": {
    "i18n": { "enabled": true, "watch": false },
    "browser": {
      "www-frontend": { "compilar": true, "ejecutar": true }
    },
    "services": {
      "www-legacy": { "compilar": true, "ejecutar": false }
    }
  },
  "framework": {
    "patch": "R034",
    "updates": "daily"
  }
}
```

> **Migración desde formatos antiguos:** hasta 2026.7, `config.workspaces.json` usaba
> `devel`/`packd` como listas planas `{available: string[], disabled: string[]}` a nivel
> raíz (sin agrupar por `deploy.type`), un `i18n: boolean` también a nivel raíz (equivalente
> solo a `workspaces.i18n.enabled`; no existía nada equivalente a `watch`), más una propiedad
> `services` (mapa de variables de entorno por servicio) que nunca llegó a consumirse en
> ningún sitio. `mrpack init`/`devel -c` migra automáticamente ese formato antiguo a
> `workspaces`, y `services` deja de generarse. Los flags por workspace se llamaron
> brevemente `packd`/`devel` (dentro ya de `workspaces`) antes de renombrarse a
> `compilar`/`ejecutar`; esa migración también es automática. El cursor de patches también
> vivió a nivel raíz como `patch` antes de trasladarse a `framework.patch`; también se migra
> automáticamente (y `yarn run patch:apply`, que lee el mismo cursor, acepta ambas ubicaciones).

#### Timeout de pausa del compilador

> Solo aplica en modo watch (`-w`); sin él, el compilador termina por sí solo tras compilar.

Para los frameworks `meteored` y `nextjs`, el compilador se pausa automáticamente
tras **5 minutos de inactividad** para liberar recursos. Se reactiva en el siguiente
cambio de fichero.

#### Edición manual de `mrpack.json` durante `devel`

> Solo aplica en modo watch (`-w`); sin él no se registra ningún watcher de ficheros.

El watcher de cada workspace **solo observa** los cambios de `mrpack.json` mientras
`mrpack devel` está en marcha: recarga el manifest en memoria (de forma síncrona y sin
tocar disco) para decidir si debe reiniciar el compilador (p. ej. si cambia el bundler
coherente) o aplicar cambios de habilitación/ejecución, pero **no escribe** ni normaliza
`mrpack.json` ni sincroniza `package.json` (`scripts.dev`, `scripts.packd`, etc.) en este
ciclo. Esa normalización/escritura solo ocurre en la fase de primera lectura: al arrancar
el proceso (construcción inicial del workspace) y en `yarn mrpack init`.

Además, si al guardar el fichero queda momentáneamente con un JSON sintácticamente
inválido (habitual mientras se edita a mano), **no se resetea ni se sobrescribe** con los
valores por defecto: el error se registra en el log y se conserva la configuración previa
hasta que el fichero vuelva a ser JSON válido. Solo se regenera con los valores por
defecto cuando el fichero no existe.

#### Log de compilación (`output/compilar.md`)

En modo `-c`, la salida del compilador de cada workspace se persiste en
`<workspace>/output/compilar.md` además de mostrarse por consola.

- Al arrancar el compilador se crea (o rota) el fichero:
  si ya existe `compilar-old.md` se elimina, `compilar.md` se renombra a `compilar-old.md`
  y se abre un nuevo `compilar.md` con la fecha/hora local de inicio.
- Cada evento de salida del compilador genera un bloque Markdown independiente:
  ```
  **HH:MM:SS**
  ` `` `
  …líneas de salida…
  ` `` `
  - [`archivo.ts:línea:col`](ruta/relativa)

  ---
  ```
- Las referencias a ficheros de código detectadas en la salida (`*.ts`, `*.scss`, etc.)
  aparecen como **enlaces** al final del bloque en el `.md` (rutas relativas al directorio
  `output/`) y como **rutas absolutas clicables** (`archivo:línea:columna`) en el stdout de la consola.
  Los duplicados se eliminan y el listado se ordena por nombre/fila/columna.
- Todas las marcas temporales usan la **hora local** del sistema (no UTC).

#### Ejemplos

```bash
# Compilar los workspaces habilitados una única vez (el proceso termina al acabar)
yarn mrpack devel -c

# Compilar en modo watch: recompila al detectar cambios, el proceso queda en ejecución
yarn mrpack devel -c -w

# Compilar y ejecutar todos los workspaces en modo watch
yarn mrpack devel -c -e -f -w

yarn mrpack devel -e
```

---

### `deploy`

> Fichero: `services/www-frontend/mrpack.json`

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

### `config`

Gestor interactivo de `config.workspaces.json`. Sin opciones abre un menú TUI.

```
yarn mrpack config
```

#### Workspaces

Una única pantalla (sin submenús) con una fila por entrada gestionable, cada una con sus
propias casillas:

| Fila | Casillas | Descripción |
|------|----------|-------------|
| **i18n** *(primera fila, solo si el proyecto tiene workspace `i18n`)* | `enabled`, `watch` | Persisten en `workspaces.i18n.enabled`/`.watch` |
| *(resto de workspaces, en orden alfabético)* | `compilar` y/o `ejecutar` (según aplique) | Persisten en `workspaces.<grupo>.<nombre>.compilar`/`.ejecutar` |

**Reglas de visibilidad de las casillas `compilar`/`ejecutar`** (las mismas que aplica `mrpack init`):

| Workspace | Casilla `compilar` | Casilla `ejecutar` |
|-----------|--------------------|--------------------|
| `deploy.runtime = "php"` | ✗ | ✗ |
| `deploy.runtime = "browser"` o `"cfworker"` | ✓ | ✗ |
| `deploy.runtime = "node"` (`build.framework = "meteored"` o `"nextjs"`) | ✓ | ✓ |

Un workspace sin ninguna casilla aplicable no aparece en la lista. Todo se edita y se guarda
desde esta misma pantalla, en una sola confirmación (`Intro`).

#### Framework

Submenú con dos acciones:

**Autoupdates** — selector de radio para `framework.updates`:

| Valor | Comportamiento |
|-------|----------------|
| `all` *(por defecto)* | Todos los paquetes con update quedan preseleccionados al arrancar `devel -c` |
| `daily` | Solo se preselecciona si la versión instalada tiene **≥ 1 día** de antigüedad |
| `weekly` | Igual que `daily` pero con umbral de **7 días** |

**Patches** — muestra el valor actual de `framework.patch` y permite eliminarlo para que `patch:apply` reaaplique todos los patches desde el inicio en el próximo arranque.

#### Navegación

| Tecla | Efecto |
|-------|--------|
| `↑` / `↓` | Navegar entre opciones (o entre filas, en "Workspaces") |
| `Intro` | Confirmar / seleccionar |
| `Esc` / `←` | Cancelar / volver al menú anterior *(en "Workspaces" solo `Esc`: `←` navega entre casillas)* |
| `Espacio` | Alternar checkbox o confirmar radio |
| `a` / `n` | Marcar todos / desmarcar todos (checkboxes o, en "Workspaces", todas las casillas) |
| `→` | Solo en "Workspaces": navegar hacia la siguiente casilla de la fila activa |

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
> `--update`, mostrando **únicamente** los paquetes con update disponible (el resto no aparece
> en la tabla), con un **timeout de 5 segundos**: si no se interactúa, se confirma la selección
> automáticamente. La preselección de cada paquete depende de la propiedad `framework.updates`
> de `config.workspaces.json` (ver sección [`devel`](#devel)); con `"all"` (por defecto) todos
> los paquetes con update quedan preseleccionados en `actualizar`.

> **Patches automáticos:** tras instalar, actualizar o resetear cualquier framework,
> `mrpack framework` ejecuta automáticamente `yarn run patch:apply` con la salida visible
> en consola, **antes** de recompilar `@mr/cli`. Si no hay patches nuevos, el comando
> finaliza de inmediato sin escanear el monorepo.

> **Resolución automática de dependencias al instalar:** cuando se instala un framework,
> `mrpack` lee sus `devDependencies` de tipo `@mr/*` y, si alguna no está presente
> localmente, la descarga e instala. El proceso es recursivo: cada framework instalado
> por dependencia pasa por el mismo control, garantizando que el árbol completo de
> dependencias queda satisfecho antes de ejecutar `yarn install`.

> **Validación de dependencias al desinstalar:** antes de eliminar un framework se
> comprueba si otro framework instalado (que no se vaya a desinstalar en la misma
> operación) depende de él. Si existe algún bloqueador, la desinstalación se cancela con
> un aviso `⚠`. La validación es iterativa: si bloquear un framework libera o bloquea
> a otros en cadena, se repiten los pases hasta que el conjunto sea estable. Solo los
> frameworks que superan la validación se desinstalan; para ellos, `mrpack` elimina
> previamente sus entradas de `devDependencies` en los workspaces consumidores
> (`services/`, `cronjobs/`, `jobs/`, `packages/`) y a continuación ejecuta
> `yarn install` para reflejar los cambios.

> **Log HTML automático al enviar:** cuando se publica una versión (`--send`), `mrpack`
> genera un fichero HTML con el detalle del push (autor, versiones, ficheros creados /
> eliminados / modificados y diff unificado de cada fichero cambiado) y lo sube al mismo
> bucket de GCS en la ruta `logs/{framework}/{YYYY-MM-DD}/{datetime}_{version}_{autor}.html`.
> Este log está diseñado para ser legible en Chrome y procesable por agentes de IA.

> **Check preventivo de autoría al enviar:** cuando hay acciones `enviar` o
> `actualizar+enviar`, `mrpack` valida el autor git al inicio (antes de instalaciones,
> updates o reseteos). La resolución se hace en este orden: `git config user.name`
> (local), `git config --global user.name` y, como último recurso,
> `GIT_AUTHOR_NAME`/`USERNAME`.

#### Modos de tabla

Cada flag abre una vista restringida de la tabla con solo las columnas y paquetes relevantes:

| Modo | Paquetes mostrados | Acciones disponibles | Preselección |
|------|--------------------|---------------------|--------------|
| Sin flag (completo) | Todos | `nada`, `instalar/actualizar`, `desinstalar`, `resetear`, `enviar` | `nada` siempre |
| `--update` | Solo con update disponible | `nada`, `actualizar` | `actualizar` para los que corresponda según `framework.updates` |
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
 * Proyecto: <url-repositorio-git>              ← solo si hay remoto `origin` configurado
 */
```

| Campo | Descripción |
|-------|-------------|
| `Editor` | Nombre git del autor que realizó el `send` |
| `Fecha` | Fecha y hora UTC del momento de publicación |
| `Hash` | MD5 del cuerpo del fichero sin el bloque de autoría (sirve para verificar integridad) |
| `Versión` | Número de versión del paquete en que se publicó este cambio (formato completo `YYYY.MM.DD+N-autor`) |
| `Anterior` | Versión que figuraba en `Versión` en la publicación anterior del mismo fichero; permite trazar el historial directamente en el fuente |
| `Proyecto` | URL del repositorio git remoto (`origin`) desde el que se realizó el `send`, con credenciales eliminadas. Indica en qué proyecto se introdujo el cambio. Se omite si el repositorio no tiene remoto configurado. |

#### Visor de diff

Al pulsar `d` sobre un paquete instalado con cambios locales o update disponible, se abre
un visor de diff interactivo. El título del panel muestra el nombre del fichero y, cuando
está disponible, el nombre del autor del cambio en `·  por <nombre>` (extraído del
`status.json` del ZIP, no del bloque de autoría del fichero):

- **Diff local** (`enviar`): autor del ZIP base, es decir, quien publicó la versión actualmente
  instalada.
- **Diff remoto** (`actualizar`): autor del ZIP remoto, quien introdujo el cambio entrante.
- **Diff side-by-side** (`ambos`): se muestra el autor del lado remoto (el cambio del update).

La fuente de autoría es `status.json`, por lo que cubre **todos los tipos de fichero**,
no solo `.ts`. El `status.json` incluye también el campo `proyecto` con la URL del
repositorio desde el que se realizó el `send` (sin credenciales), lo que permite saber
en qué proyecto se introdujo cada cambio.

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
| OK | [`package.json`](../core/dev/package.json) |
| Error | [`src/conflicto.ts`](../../@mr/core/dev/src/conflicto.ts) |

## Salida del proceso

<salida adicional del proceso>
```

Si `applyUpdate` lanza una excepción (por ejemplo, un fallo al descargar el paquete o al
aplicar el merge), no hay ficheros afectados (`entradas` queda vacío), pero el log se
escribe igualmente e incluye una sección `## Error` con el mensaje/stack de la excepción,
justo antes de `## Salida del proceso`:

```markdown
## Error

<mensaje o stack de la excepción>
```

En este caso se imprime también un aviso `⚠` con la ruta al log, y en el flujo
`actualizar+enviar` el envío (`push`) se omite para ese paquete.

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
- Crea (o corrige) el enlace `.github` → `@mr/core/dev/.github`. En **Linux/macOS** se
  crea un symlink relativo estándar; en **Windows** se usa una *junction* de directorio,
  que no requiere permisos de administrador ni Developer Mode.
- Crea (o corrige) el enlace `AGENTS.md` → `@mr/core/dev/AGENTS.md`.
- Crea (o corrige) el enlace `CLAUDE.md` → `@mr/core/dev/CLAUDE.md`. Este fichero canónico
  contiene los imports `@AGENTS.md` y `@.github/copilot-instructions.md`, ya que Claude Code
  no lee ninguno de los dos automáticamente (ni siquiera de forma transitiva: la mención a
  `.github/copilot-instructions.md` dentro de `AGENTS.md` es texto entre backticks, no un
  import) y así reutiliza las mismas instrucciones sin duplicarlas.
- Por cada workspace en `services/`, `packages/`, `jobs/` y `cronjobs/`, propaga de forma
  recursiva las `dependencies` **y** `optionalDependencies` de producción de todos sus
  `devDependencies` de tipo `@mr/*` (incluidas las dependencias transitivas), resolviendo
  conflictos de versión eligiendo siempre la más reciente.
- `bufferutil` se elimina de `dependencies` si estuviera presente (por propagación transitiva
  o por declaración previa), ya que este módulo nativo solo debe aparecer en `optionalDependencies`.
- Elimina artefactos legacy en `@mr/cli` si existen (`status.json` y `bin/mrdev.js`).
- Gestiona el campo `resolutions` del `package.json` raíz: elimina entradas obsoletas
  (`@elastic/elasticsearch`, `@types/node`, `mysql2`, `gaxios`, `node-fetch`) y
  borra el campo si queda vacío.
- En la autocorrección de `Dockerfile` por workspace, solo inserta `ENV NODE_ENV=production`
  (junto a `COPY ./yarn.lock ./`) cuando `deploy.runtime = "node"`.
- Normaliza `build.bundler` en `mrpack.json` según runtime/framework:
  `browser -> rspack`, `php/cfworker -> none`, `node+nextjs -> none`, `node+componentes -> rspack`,
  `node+bundle.web -> rspack`. La condición de `componentes` mira tanto el bundle principal
  (`build.bundle.componentes`) como cualquier entrada de `build.bundle.web[]`; la de `bundle.web`
  se cumple con que exista al menos un bundle web adicional, tenga o no `componentes`, ya que
  esbuild no soporta `bundle.web` en absoluto (solo compila una única entrada Node).
  En los casos `node` donde el valor por defecto es `esbuild`, si el usuario establece
  manualmente `rspack` se respeta (no se corrige automáticamente).
  Excepción: si el workspace declara `reflect-metadata` en `dependencies`, o declara algún
  `build.bundle.web[]`, se fuerza `rspack` aunque el runtime/framework apunte a `esbuild` o el
  manifest lo indique explícitamente, ya que esbuild no emite `decoratorMetadata` (necesario
  para que `reflect-metadata` funcione en tiempo de ejecución) ni soporta `bundle.web`,
  mientras que rspack sí soporta ambos (`decoratorMetadata` vía `builtin:swc-loader`, y
  `bundle.web` generando una configuración de bundle adicional por cada entrada).
- En workspaces `node+nextjs`, normaliza `scripts.dev` a `NEXTJS_PORT=<puerto> yarn g:nextjs`
  preservando el puerto legacy detectado en el script anterior: `NEXTJS_PORT=<n>` o
  cualquier invocación que contenga `next dev` seguido de `-p <n>` / `--port <n>` /
  `--port=<n>` (con o sin `yarn`/`yarn run` delante, y con posibles flags adicionales antes
  o después del puerto). Si no encuentra puerto previo, usa `8080` por defecto. El script
  raíz `g:nextjs` ejecuta `next dev` en `$INIT_CWD` con `-p ${NEXTJS_PORT:-8080}`.

  > **Nota:** La resolución `node-fetch` (shim de compatibilidad para Node.js 24.0–24.17)
  > fue necesaria durante el desarrollo pero quedó obsoleta con Node.js **24.18**, que
  > corrige el comportamiento de streams que rompía `node-fetch@2.x`.

- Regenera `.run/` con una acción de depuración (`{type}-{service}.run.xml`) por cada workspace
  cuyo `deploy.type` sea `service`/`cronjob`/`job` y que tenga `enabled: true`,
  `devel.enabled: true` y `build.framework: "meteored"`, permitiendo depurarlo individualmente
  desde el IDE (ver [Integración con IDEs](#integración-con-ides-jetbrains--vs-code)). Si el
  directorio no existe se crea; si ya existe, se eliminan las acciones de workspaces que ya no
  cumplan esas condiciones y se regeneran las vigentes, dejando intactos otros ficheros
  `.run.xml` no gestionados por `mrpack`.
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

> **Patches automáticos:** `yarn mrpack update` aplica automáticamente `yarn run patch:apply`
> después de actualizar los frameworks. No es necesario ejecutarlo a mano salvo que se
> quiera relanzar de forma explícita.
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
| Compilar workspaces habilitados (una única vez) | `yarn mrpack devel -c` |
| Compilar workspaces habilitados en modo watch | `yarn mrpack devel -c -w` |
| Compilar **todos** los workspaces en modo watch | `yarn mrpack devel -c -f -w` |
| Compilar y ejecutar workspaces habilitados en modo watch | `yarn mrpack devel -c -e -w` |
| Compilar y ejecutar **todos** los workspaces en modo watch | `yarn mrpack devel -c -e -f -w` |
| Solo ejecutar (sin recompilar) | `yarn mrpack devel -e` |
| Build de producción | `yarn mrpack deploy --env=produccion` |
| Build de test/staging | `yarn mrpack deploy --env=test` |
| **Gestión de config.workspaces.json** | `yarn mrpack config` |
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
| `cliente.ts` | Operaciones de cliente: `add(basedir, frameworks, visitados?)`, `remove`, `checkCliente`, `recompilarCliente`, `getAutor`, `getClienteHash`, `getClienteMD5`, `pullPackage`; helpers de dependencias: `leerDepsMrFramework(localDir)`, `encontrarWorkspacesConDep(basedir, npmName)`, `limpiarDevDepsConsumidores(basedir, npmNames)` |
| `gestor.ts` | Todo el ciclo de vida de paquetes: `gestionar`, `actualizarTodo`, `enviarTodo`, `resetearTodo`; `GestorTabla`, `construirInfoPaquetes`, `ejecutarAcciones`; `const enum Accion`, `type GestorModo`, `IPaqueteGestion` |
| `index.ts` | Barrel que re-exporta todo lo anterior |

Además, `src/mrpack/clases/patches.ts` expone la función compartida `aplicarPatches(basedir)`
usada tanto por el gestor de frameworks como por el comando `update`.

### `GestorTabla`

La tabla interactiva soporta cuatro modos configurables en el constructor:

| Parámetro | Tipo | Por defecto | Descripción |
|-----------|------|-------------|-------------|
| `infos` | `IPaqueteGestion[]` | — | Lista de paquetes a mostrar |
| `modo` | `GestorModo` | `"todos"` | Modo de operación (ver tabla de modos) |

**Modos disponibles (`GestorModo`):**

| Valor | Acciones disponibles | Preselección | Atajos de teclado |
|-------|---------------------|--------------|-------------------|
| `"todos"` | `nada`, `instalar/actualizar`, `desinstalar`, `resetear`, `enviar` | `nada` siempre | `n`, `a`, `r`, `e` |
| `"update"` | `nada`, `actualizar` | `actualizar` si hay update | `n`, `a` |
| `"reset"` | `nada`, `resetear` | `resetear` | `n`, `r` |
| `"send"` | `nada`, `enviar` / `actualizar+enviar` | `enviar` o `actualizar+enviar` | `n`, `e` |

> `actualizarTodo`, `enviarTodo` y `resetearTodo` filtran `infos` antes de construir la tabla,
> de modo que en modo interactivo solo se muestran los paquetes relevantes para la operación
> (con update disponible, con cambios locales, o instalados, respectivamente). Las acciones
> elegidas se remapean después al array completo de paquetes para aplicarlas con `ejecutarAcciones`.

El método `run(autoConfirmMs?)` acepta un timeout de auto-confirmación en milisegundos:
- Sin parámetro → espera indefinidamente (modo `gestionar`).
- Con valor (e.g. `5000`) → muestra una cuenta atrás en la tabla y confirma automáticamente al expirar; el primer keypress cancela el timer.

Los **slots** de acciones se pre-calculan en el constructor para evitar allocaciones durante el renderizado.

### `ejecutarAcciones`

Función interna que aplica un array de acciones sobre los paquetes cargados. Características:
- **Despacho O(n)**: un único bucle `switch` en lugar de 6 pases `filter+map`.
- **`getAutor()` preventivo y único**: cuando hay algún paquete a enviar, el autor git se valida una sola vez al inicio para fallar rápido antes de ejecutar acciones costosas.
- **Fallback de autor git**: `getAutor()` resuelve en cascada con config local, global y variables de entorno (`GIT_AUTHOR_NAME`/`USERNAME`), y muestra instrucciones de configuración si no encuentra valor.
- **Paralelización total**: instalaciones+actualizaciones, resets y envíos corren con `Promise.all`.
- **Resolución de dependencias al instalar, actualizar o resetear**: tras el bloque paralelo de instalaciones/actualizaciones y tras los resets, se recopilan las `devDependencies` `@mr/*` de todos los paquetes afectados (`aInstalar`, `aActualizar`, `aResetear`) y se llama a `add()` para instalar las que falten. `add()` es recursiva: aplica el mismo proceso a cada framework instalado por dependencia, garantizando el árbol completo antes del `yarn install`.
- **Validación de dependencias al desinstalar**: antes de eliminar un framework se construye el mapa inverso de dependencias entre todos los frameworks instalados. Se calcula iterativamente el subconjunto que puede desinstalarse (aquellos cuyos dependientes también se van a desinstalar o no existen). Los frameworks bloqueados reciben un aviso `⚠` y no se eliminan. Para los que pasan la validación, se limpian sus entradas de `devDependencies` en los workspaces consumidores (`services/`, `cronjobs/`, `jobs/`, `packages/`) y luego se eliminan sus directorios.
- **`yarn install` solo si hubo cambios reales**: `necesitaInstall` se computa sobre las instalaciones, actualizaciones y reseteos reales. Para desinstalaciones, solo se activa si al menos un framework fue efectivamente eliminado.
- **Consola reciclada en resets**: `setupConsolaParaUpdate` se invoca antes del bloque de reset, igual que en instalaciones, actualizaciones y envíos, de modo que cada paquete actualiza su propia línea en lugar de crear líneas nuevas.
- **Estado `[CONFLICTO]`**: cuando el merge 3-way produce conflictos, la línea de progreso muestra `[CONFLICTO]` en morado en lugar de `[ERROR    ]`.
- **Avisos diferidos**: los mensajes de conflicto/error ya no se imprimen dentro del `Promise.all` (lo que descolocaba las líneas de progreso). Se acumulan en un array `avisos[]` y se muestran todos juntos al finalizar todas las acciones.
- **`patch:apply` automático antes de recompilar**: tras cada `yarn install` (flujo principal y flujo de resolución de conflictos), `aplicarPatches(basedir)` ejecuta `yarn run patch:apply` con `stdio: "inherit"` (salida en tiempo real), garantizando que cualquier cambio introducido por los patches quede incorporado antes de la recompilación de `@mr/cli`.
- **Parámetro `reiniciar`** (`true` por defecto): controla si se permite el reinicio automático del proceso tras recompilar `@mr/cli`. Se pasa `false` desde `mrpack framework` para evitar el bucle de reinicio infinito cuando el CLI se actualiza con conflictos.

Los imports externos (`from "./framework"`) resuelven automáticamente a `framework/index.ts`.

### `initYarnRC` (en `clases/init.ts`)

Regenera el `.yarnrc.yml` del monorepo usando `js-yaml`:
- Parsea el fichero existente a un objeto `IYarnRC` tipado con `yamlLoad`.
- Añade o actualiza los campos de seguridad requeridos.
- Elimina las `packageExtensions` obsoletas y añade las nuevas.
- Serializa con `yamlDump({ sortKeys: true, lineWidth: -1 })` y añade una línea en blanco
  entre cada clave de nivel raíz para mejorar la legibilidad.

---

## Compilación del paquete

Los ejecutables de `@mr/cli` se generan con **[esbuild](https://esbuild.github.io/)**
a partir del código TypeScript en `src/`. El resultado son dos ficheros en `bin/min/`:

| Fichero | Origen |
|---------|--------|
| `bin/min/mrpack-run.js` | `src/mrpack/main.ts` |
| `bin/min/mrlang-run.js` | `src/mrlang/main.ts` |

### Scripts disponibles

| Script | Descripción |
|--------|-------------|
| `yarn workspace @mr/cli run compile` | Build de producción: esbuild (minificado) + `tsc --noEmit` en paralelo. Falla si hay errores de tipos. |
| `yarn workspace @mr/cli run compile:watch` | Watch: esbuild reconstruye en ~50 ms al guardar; `tsc --watch` muestra errores de tipos en tiempo real. |
| `yarn workspace @mr/cli run compile:rspack` | Fallback al bundler anterior (rspack). |

> **Nota de rendimiento:** esbuild tarda ~70 ms en bundlear; el tiempo total del script
> `compile` (~0.85 s) lo determina `tsc --noEmit`, que corre en paralelo.

### Características del bundle

- **Target:** `node24` — aprovecha las APIs nativas de Node 24 sin transpilación innecesaria.
- **Externals:** solo las `dependencies` de `package.json` se marcan como externas (no se
  bundlean). Los workspace devDeps (`services-comun`, `@mr/core-*`…) se bundlean inline
  porque son TypeScript puro sin compilar. `typescript` se excluye explícitamente para
  evitar incluir sus 9 MB de fuente.
- **Sin code splitting:** cada ejecutable es un único fichero CJS autocontenido, sin chunks
  intermedios. Tamaño resultante: `mrpack-run.js` ~169 kB, `mrlang-run.js` ~85 kB.
- **Source maps:** ficheros `.js.map` adyacentes; `source-map-support` los carga
  automáticamente al arrancar.

> **Resolución de `tscBin`:** el binario de `tsc` se localiza componiendo la ruta a partir
> de `typescript/package.json` (`require.resolve("typescript/package.json")` +
> `bin/tsc`), en lugar de `require.resolve("typescript/bin/tsc")`. Este último subpath dejó
> de estar expuesto en el campo `exports` del `package.json` de TypeScript 7, por lo que
> fallaba con `ERR_PACKAGE_PATH_NOT_EXPORTED`.
>
> **Versión de `typescript` fijada en `^6.x`:** TypeScript 7 (compilador nativo en Go,
> "Corsa"/`tsgo`) todavía no soporta resolución de módulos bajo Yarn PnP (ver
> [microsoft/typescript-go#460](https://github.com/microsoft/typescript-go/issues/460) y el
> PR [#1966](https://github.com/microsoft/typescript-go/pull/1966), sin fusionar). Con TS7,
> `tsc --noEmit`/`--watch` no encuentra ningún módulo de workspace (`services-comun/...`,
> `@mr/core-*`, etc.), aunque esbuild sí compila correctamente. No actualizar a `^7.x` hasta
> que ese soporte se publique en una versión estable.

---

## Integración con IDEs (JetBrains / VS Code)

Para facilitar la ejecución y depuración de las herramientas del monorepo (`mrpack` y `mrlang`), este paquete incluye configuraciones de ejecución compartidas que se sincronizan entre todos los proyectos:

### JetBrains (PhpStorm, WebStorm, etc.)
* **Ubicación**: `.run/`
* Al abrir cualquier proyecto que incorpore este CLI, el IDE importará automáticamente las configuraciones de la barra de herramientas superior (ej. `develop => Ejecutar`, `develop => Compilar`, `cli => Actualizar`, etc.).
* `yarn mrpack init` regenera además, en la raíz del proyecto, una acción `ejecutar => {type} => {service}`
  (fichero `.run/{type}-{service}.run.xml`) por cada workspace cuyo `deploy.type` sea
  `service`/`cronjob`/`job`, esté habilitado para desarrollo (`enabled` + `devel.enabled`) y use
  el framework `meteored`, permitiendo depurarlo individualmente (`yarn workspace {service} run devel`)
  desde el IDE sin configuración manual.

### VS Code
* **Ubicación**: `.vscode/`
* Cuando se abre un espacio de trabajo multi-root (como `vscode.code-workspace`), VS Code cargará automáticamente:
  * **Tareas (`tasks.json`)**: accesibles con `Cmd+Shift+B` o a través del menú de tareas, permitiendo lanzar comandos `mrpack devel` o `mrpack update` directamente en la terminal integrada.
  * **Lanzadores (`launch.json`)**: accesibles con `Cmd+Shift+D` para iniciar depuración con breakpoints de `mrpack` o conectarse (*Attach*) a puertos de inspección de Node.js.

---

## Troubleshooting

### `No se puede obtener el usuario de git`

Al intentar enviar un framework (`enviar` / `actualizar+enviar`), `mrpack` necesita el nombre
del autor para sellar el bloque de autoría de cada fichero. Si no puede resolver el nombre,
muestra este error y aborta la operación.

**Causa más habitual:** git no tiene configurado `user.name` ni a nivel de repositorio ni
a nivel global.

**Solución:**

```bash
git config --global user.name "Tu Nombre"
```

O bien, si solo quieres configurarlo para este repositorio:

```bash
git config user.name "Tu Nombre"
```

El orden de resolución que sigue `mrpack` es:
1. `git config user.name` (configuración local del repositorio)
2. `git config --global user.name` (configuración global)
3. Variable de entorno `GIT_AUTHOR_NAME` o `USERNAME`

---

### `Error: spawn yarn ENOENT` (Windows)

En Windows, `yarn` se instala como wrapper `.cmd` y Node no lo encuentra sin shell.
Esta corrección ya está incluida desde la versión `2026.6.12+2`; si sigues viendo el error,
verifica que la versión del CLI está actualizada con:

```powershell
yarn mrpack framework --send
```

---

### Enlace simbólico `.github` falla con `EPERM` (Windows)

Los symlinks de directorio en Windows requieren privilegios de administrador o el
modo desarrollador activado. `mrpack init` crea automáticamente una **junction** en su
lugar (que no necesita permisos especiales). Si el error persiste, comprueba que estás
ejecutando con la versión `2026.6.12+2` o superior.

---

### Cambios en frameworks no detectados / credenciales de GCS caducadas (Windows)

Si `mrpack framework --send` no muestra tus cambios locales, puede que el token de
Application Default Credentials haya caducado. Ejecuta:

```bash
gcloud auth application-default login
```

`mrpack` intentará relanzar este comando automáticamente cuando detecte el error
(`invalid_grant`, `UNAUTHENTICATED`, etc.), pero si el proceso falla o no hay terminal
interactiva disponible, es necesario ejecutarlo manualmente.
