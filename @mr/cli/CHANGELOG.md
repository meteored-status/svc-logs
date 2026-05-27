# [Changelog](https://keepachangelog.com/en/1.1.0/)

---

## 2026.5.26+1

### Changed

- `clases/framework/index.ts` — eliminado el sufijo redundante `/index` en el re-export del
  gestor (`from "./gestor"`), tras borrar el fichero legado `clases/framework/gestor.ts`.

- `clases/framework/gestor/tabla.ts` — integrada la utilidad compartida
  `utiles/output-capture.ts` para capturar salida externa durante el modo interactivo y
  mostrarla al finalizar la tabla.

### Fixed

- `clases/framework/gestor/tabla.ts` — corregido el redibujado incremental de la tabla:
  `Colors.up(...)` quedaba interceptado y no movía el cursor, provocando que cada pulsación
  imprimiera un bloque nuevo en el scroll. Ahora toda la secuencia de pintado se ejecuta con
  el flag interno de dibujado activo.

- `clases/framework/gestor/acciones.ts` y `clases/framework/cliente.ts` — tras ejecutar acciones
  de `instalar`, `actualizar`, `resetear` o `desinstalar`, se lanza `yarn install` antes de
  una posible recompilación de `@mr/cli`, y también tras resets en la tabla de conflictos.
  Además, `recompilarCliente(...)` acepta `skipInstall` para evitar instalaciones duplicadas.

---

## 2026.5.25+1

### Fixed

- `paquete/index.ts` — `calcularHashCambiado()` ahora llama a `reloadPaquete()` antes de
  modificar `this.paquete`. Sin este reload, si el usuario editaba `package.json` en disco
  (p. ej. añadiendo una dependencia) después de que el CLI cargara el `Paquete`, `savePaquete()`
  sobreescribía esos cambios con el contenido antiguo en memoria antes de escanear el árbol,
  provocando que el hash coincidiera con el remoto y el CLI reportara "no hay cambios" al enviar.

---

## 2026.5.22+2

### Fixed

- `workspace/service.ts` — `checkEjecucion()` ahora comprueba `config.enabled` igual que
  `checkCompilar()`. Cuando el `mrpack.json` del workspace tiene `enabled: false`, el servicio
  ya no se lanza en modo `devel` (antes se ignoraba solo la compilación, pero la ejecución
  seguía arrancando).

---

## 2026.5.22+1

### Fixed

- `paquete/index.ts` — corregido bug en `reset()` por el que, tras restaurar todos los
  ficheros del ZIP vía `resetearVersion()`, se llamaba a `savePaquete()` con el contenido
  antiguo de `this.paquete` en memoria (solo con la versión actualizada), sobreescribiendo el
  `package.json` correcto que `resetCambios` acababa de escribir desde el ZIP.
  Consecuencia: dependencias nuevas o modificadas en el `package.json` remoto (p. ej.
  `"sass-embedded": "^1.99.0"`) desaparecían después de un reset.

  **Solución:** tras `resetearVersion()`, se recarga `this.paquete` desde disco con
  `reloadPaquete()` y se elimina la llamada a `savePaquete()` (el fichero ya está correcto).

---

## 2026.5.21+6

### Added

- `config.workspaces.json` — nueva propiedad `framework.updates` con tres valores posibles:

  | Valor | Comportamiento en `yarn mrpack devel -c` |
  |-------|------------------------------------------|
  | `"all"` *(por defecto)* | Todos los paquetes con update disponible quedan **preseleccionados en `actualizar`** |
  | `"daily"` | Solo se preselecciona `actualizar` si la versión instalada lleva **1 día o más** publicada; en caso contrario, preselecciona `nada` |
  | `"weekly"` | Igual que `daily` pero con umbral de **7 días** |

  Un valor no reconocido en el fichero se normaliza automáticamente a `"all"`.
  La propiedad se escribe automáticamente al ejecutar `mrpack init` si no existía.

- `workspace/service.ts` — nuevo `const enum FrameworkUpdates` (`all` / `daily` / `weekly`) y
  función exportada `sanitizeFrameworkUpdates(value)` que garantiza que cualquier valor leído del
  JSON sea uno de los tres permitidos (convierte el resto a `"all"`).

- `paquete/index.ts` — nuevo método público `getVersionesRemota(): Promise<string[]>` que devuelve
  (y cachea en `_listaCache`) el historial completo de versiones de `stable.txt`. La detección de
  franja temporal en `daily`/`weekly` comprueba si la versión local está en este historial antes de
  evaluar su antigüedad: si no aparece (publicada hace más de 7 días), se preselecciona `actualizar`.

- `framework/gestor.ts`
  - `IPaqueteGestion` — nuevo campo `versionesRemota: string[]` con el historial descargado de
    `stable.txt`.
  - `GestorTabla` — nuevo tercer parámetro `frameworkUpdates` en el constructor
    (defecto `FrameworkUpdates.all`); añadido método privado `debeActualizar(info)` que aplica
    la política elegida.
  - `parsearFechaVersion(version)` — función módulo privada que extrae la fecha UTC del campo
    `YYYY.MM.DD` de una cadena de versión; usada por `debeActualizar`.
  - `actualizarTodo` — nuevo cuarto parámetro `frameworkUpdates`, propagado a `GestorTabla`.

- `devel.ts` — lee `config.workspaces.json` antes de llamar a `actualizarTodo` y pasa
  `framework.updates` (sanitizado) al gestor de frameworks.

---

## 2026.5.21+5

### Added

- `paquete/index.ts` — `stable.txt` pasa de contener una única versión a contener el
  historial de versiones publicadas en los **últimos 7 días**, una por línea, de más reciente
  a más antigua. Al publicar (`subirLatest`), se descarga la lista actual sin caché, se
  antepone la nueva versión, se eliminan duplicados y se descartan las entradas con fecha de
  publicación anterior a los 7 días. La versión actual siempre queda incluida aunque caiga
  justo en el límite.

  Los consumidores existentes siguen recibiendo la primera línea como versión más reciente,
  por lo que el cambio es completamente compatible con ficheros de una sola línea (formato
  anterior).

---

## 2026.5.21+4

### Added

- `deployment/std/kustomizar.sh` — soporte para `deploy.annotations.service` en el
  `mrpack.json` del workspace. Cada clave/valor del mapa se inyecta en
  `metadata.annotations` del manifiesto generado para Cloud Run.

### Changed

- `src/mrpack/clases/manifest/workspace/deployment/index.ts` — el loader de `deploy`
  conserva y propaga la propiedad `annotations` al modelo normalizado del workspace.

---

## 2026.5.21+3

### Added

- `paquete/directory.ts` — nuevo fichero marcador `.mr-nohash`. Cuando existe en un
  directorio del paquete, lista (una entrada por línea) los hijos —archivos o subdirectorios—
  cuya hash **no contribuye** al hash del directorio padre. Los hijos marcados se incluyen
  normalmente en el ZIP al publicar, pero los cambios en ellos no disparan la detección de
  cambios del paquete.

  Ejemplo: colocar `bin/.mr-nohash` con contenido `min` hace que las modificaciones en
  `bin/min/` no generen una nueva versión del paquete.

### Fixed

- `paquete/index.ts` — `savePaquete()` pasaba `safeWrite(…, true)` sin el cuarto parámetro
  `excepcion`. Si el renombrado atómico del fichero temporal fallaba (p.e. por un problema de
  disco transitorio), la función devolvía `false` en silencio y `package.json` quedaba con la
  versión **anterior** a pesar de que el ZIP ya había sido subido a GCS. La siguiente ejecución
  descargaba el ZIP antiguo, detectaba diferencias y marcaba el paquete como pendiente de envío
  de forma indefinida. Corregido pasando `excepcion: true` para que el error se propague.

---

## 2026.5.21+2

### Changed

- `modulos/framework.ts` — añadido flag `-y` / `--yes`. Cambia el comportamiento de
  `--update`, `--reset` y `--send`:

  | Comando | Sin `-y` (nuevo) | Con `-y` (antes era el único comportamiento) |
  |---------|-----------------|----------------------------------------------|
  | `--update` | Tabla interactiva con solo "nada" / "actualizar"; paquetes con update preseleccionados | Actualiza todos directamente sin tabla |
  | `--reset`  | Tabla interactiva con solo "nada" / "resetear"; instalados preseleccionados | Resetea todos directamente sin tabla |
  | `--send`   | Tabla interactiva con solo "nada" / "enviar"; paquetes con cambios preseleccionados | Envía todos directamente sin tabla |

- `clases/framework/gestor.ts`:
  - Añadido tipo `GestorModo` (`"todos" | "update" | "reset" | "send"`) que reemplaza el
    parámetro `soloUpdate: boolean` del constructor de `GestorTabla`.
  - `GestorTabla` adapta `slots`, acciones disponibles, valores por defecto de fila, ancho,
    y shortcuts de teclado (`a`, `r`, `e`) según el modo activo.
  - `enviarTodo(basedir, forzar, reiniciar)` — nuevo parámetro `forzar`. Con `forzar=false`,
    filtra los paquetes con cambios locales y muestra la tabla en modo `"send"`.
  - `resetearTodo(basedir, forzar, reiniciar)` — nuevo parámetro `forzar`. Con `forzar=false`,
    filtra los paquetes instalados y muestra la tabla en modo `"reset"`.

---

## 2026.5.21+1

### Fixed

- `bin/lib.js` — suprimido el warning `[DEP0040] DeprecationWarning: The punycode module is
  deprecated` que emitía Node 24 al arrancar `mrpack`. El origen es la cadena de dependencias
  transitivas `dd-trace` + `@google-cloud/storage` → `node-fetch@2.7.0` → `whatwg-url@5.0.0`
  → `tr46@0.0.3` → `require('punycode')`. Actualizar `tr46@0.0.3` requeriría romper
  `node-fetch@2.x` (dependencia interna de `gaxios` / `teeny-request`), por lo que se
  intercepta `process.emit` al inicio del proceso y se filtra únicamente el código `DEP0040`,
  dejando pasar todos los demás warnings.

- `comando.ts` — cambiado el valor por defecto de `shell` de `true` a `false`. Con `shell: true`
  y args pasados como array, Node 24 emite `[DEP0190] DeprecationWarning: Passing args to a child
  process with shell option true can lead to security vulnerabilities`. Como el comando y los
  parámetros siempre se pasan por separado (array), el shell no es necesario para expandir ningún
  patrón; pasar directamente el ejecutable es la forma segura y recomendada.

- `workspace/service.ts` — cambiado `shell: true` a `shell: false` en el `spawn` de
  `initEjecutar`. Mismo motivo que el cambio anterior: `"yarn"` + `["run", nombre, "run", "devel"]`
  son argumentos limpios que no necesitan expansión de shell.

---

## 2026.5.20+1

### Fixed
- [Jose] `paquete/index.ts` — el `package.json` incluido en el ZIP generado por `subirPaquete`
  contenía todavía la versión **anterior** porque `this.paquete.version` se actualizaba y se
  guardaba a disco **después** de llamar a `subirPaquete`. Los dos bloques `if (!Paquete.SIMULAR)`
  se han fusionado en uno y se ha reordenado la secuencia de operaciones:
  1. `this.version = status.version` (nueva versión en memoria)
  2. `prepararParaPush(autor)` (inyecta autorías en los `.ts`)
  3. `this.paquete.version = this.version` + `savePaquete()` → **`package.json` en disco actualizado**
  4. `subirPaquete(status)` → el ZIP ya contiene el `package.json` con la versión nueva
  5. `subirLatest()`

  Cuando `Paquete.SIMULAR = true`, el bloque `else` actualiza `paquete.version` y llama a
  `savePaquete()` como antes, sin subir nada a GCS.

  Para sanar los paquetes ya publicados con el bug (ZIP con versión vieja en `package.json`),
  basta con ejecutar **actualizar+enviar** desde el gestor interactivo: el pull aplica los
  cambios del ZIP y el push sube un nuevo ZIP con la versión correcta.

---
## 2026.5.19+1

### Added
- [Jose] `paquete/index.ts` — nuevo estado `ConsolaEstado.CONFLICTO` con color magenta
  brillante (morado). Al aplicar un update con conflictos de merge, la línea de progreso
  muestra ahora `[CONFLICTO]` en lugar de `[ERROR    ]`.
- [Jose] `paquete/index.ts` — padding uniforme de **9 caracteres** en todos los estados
  del objeto `STATUS` para que las cajas `[…]` tengan siempre el mismo ancho:
  `[         ]`, `[PENDING  ]`, `[OK       ]`, `[ERROR    ]`, `[CONFLICTO]`.
- [Jose] `cliente.ts` — `recompilarCliente(basedir, hash, reiniciar = true)`: nuevo
  tercer parámetro opcional. Cuando `reiniciar = false`, el CLI se recompila igualmente
  pero el proceso **no se relanza** aunque el binario haya cambiado. Evita el bucle
  infinito cuando se actualiza `@mr/cli` desde `mrpack framework`.
- [Jose] `gestor.ts` — `ejecutarAcciones`, `gestionar`, `actualizarTodo`, `enviarTodo` y
  `resetearTodo` reciben el parámetro `reiniciar = true` y lo propagan hasta
  `recompilarCliente`. El parámetro controla si se permite el reinicio automático del
  proceso tras recompilar el CLI.

### Changed
- [Jose] `gestor.ts` — `ejecutarAcciones`: los mensajes de conflicto/error que antes se
  imprimían con `console.log` directamente dentro del `Promise.all` (descolocando las
  líneas de progreso) se acumulan ahora en un array `avisos[]` y se imprimen todos juntos
  **al final**, una vez que han terminado todas las acciones en paralelo.
- [Jose] `modulos/framework.ts` — todas las llamadas a `actualizarTodo`, `resetearTodo`,
  `enviarTodo` y `gestionar` pasan `reiniciar = false`. Esto garantiza que al invocar
  cualquier variante de `yarn mrpack framework` el proceso **nunca** se reinicia
  automáticamente al actualizar `@mr/cli`, eliminando el bucle de reinicio sin fin cuando
  hay conflictos en la actualización del CLI.

---
## 2026.5.15+next

### Added
- [Jose] `README.md` — añadida referencia al sistema de parches de migración en la sección
  `update`: nota sobre `yarn workspace @mr/core-dev mrpack:patch:apply` y enlace a
  `@mr/core/dev/patches/README.md`.
- [Jose] `README.md` — añadidas dos filas a la tabla de referencia rápida:
  **"Aplicar parches de migración"** (`mrpack:patch:apply`) y
  **"Comprobar parches pendientes (CI)"** (`mrpack:patch`).

### Fixed
- [Jose] `paquete/directory.ts` — `addNuevos` sobreescribía **todos** los `PaqueteFile` del
  árbol (incluidos los ya cargados desde el `status.json` del ZIP) con objetos nuevos cuyo
  `hash` era `""` (DEFECTO). Esto provocaba que `recalcularHash` detectara siempre cambios
  en todos los archivos (`antiguo=""`) y actualizara la autoría de todos los `.ts` en cada
  `send`, aunque su contenido no hubiera variado. Corregido añadiendo la guarda
  `if (this.archivos[file] === undefined)` (ídem para directorios) para que solo se registren
  ficheros realmente nuevos en disco.
- [Jose] `paquete/index.ts` — `savePaquete()` se llamaba **antes** de `subirPaquete()`.
  Si el proceso se interrumpía entre ambas llamadas, `package.json` quedaba con la versión
  nueva pero el ZIP nunca llegaba a GCS; el siguiente `send` buscaba ese ZIP inexistente
  y reconstruía el estado desde cero (todos los hashes a `""`), perpetuando el ciclo de
  falsos cambios. Corregido reordenando para que `savePaquete()` se ejecute siempre
  **después** de `subirPaquete()` y `subirLatest()`.
- [Jose] `paquete/file.ts` — el bloque de autoría (`Editor / Fecha / Hash`) se incluía en
  el cálculo del hash del fichero, de modo que actualizar solo la fecha del comentario
  generaba un hash distinto y forzaba un `send` innecesario. Introducida la función
  `stripAutoria` (patrón `PATRON_AUTORIA`) que elimina el bloque antes de calcular el hash,
  garantizando que solo los cambios reales en el cuerpo del fichero generan una nueva versión.

### Added
- [Jose] `paquete/file.ts` — el bloque de autoría de los ficheros `.ts` incluye ahora el
  campo `* Versión: YYYY.MM.DD+N-autor` con el número de versión completo del paquete
  que se está publicando.
- [Jose] `paquete/file.ts` — el bloque de autoría incluye también el campo `* Anterior: X`
  con la versión que figuraba en `* Versión:` del bloque anterior (si existía), permitiendo
  trazar el historial de versiones directamente en el fichero.
- [Jose] `framework/gestor.ts` — los logs de `tmp/log/` pasan a formato Markdown
  (`.pull.md` y `.push.md`) e incluyen enlaces clickables a los ficheros afectados para abrirlos
  directamente desde el entorno.
- [Jose] `framework/gestor.ts` — añadido `tmp/log/index.md`, regenerado automáticamente
  al escribir cada log, con índice de logs de update/push y enlaces clickables.

---
## 2026.5.14+7

### Fixed
- [Jose] `ejecutarAcciones` — al resetear paquetes la consola creaba una línea nueva por
  cada paquete en lugar de reciclar la línea existente. Añadido `Paquete.setupConsolaParaUpdate`
  antes del `Promise.all` de resets, igual que ya hacían los bloques de instalación,
  actualización y envío.

### Changed
- [Jose] `init.ts` — `initYarnRC` reescrito usando `js-yaml` (`yamlLoad` / `yamlDump`)
  en lugar de manipulación manual de strings (split / indexOf / splice). La función ahora
  parsea el `.yarnrc.yml` a un objeto `IYarnRC` tipado, modifica los campos necesarios y
  serializa de vuelta con `sortKeys: true` y una línea en blanco entre cada clave de
  nivel raíz. Reducción de ~60 líneas a ~35.
- [Jose] `init.ts` — añadida interfaz `IYarnRC` con todos los campos del `.yarnrc.yml`.
- [Jose] `@mr/cli/package.json` — añadidas dependencias `js-yaml@^4.1.0` y
  `@types/js-yaml@^4.0.9`.

### Added
- [Jose] `initYarnRC` asegura ahora también los campos de seguridad
  `checksumBehavior: throw`, `enableStrictSsl: true` y `unsafeHttpWhitelist: []`
  junto con los ya existentes `enableHardenedMode: true` y `npmMinimalAgeGate: 1440`.

---
## 2026.5.14+5

### Fixed
- [Jose] `ejecutarAcciones` — mensajes duplicados al enviar: `enviarTodo` ya imprime
  `"Enviando N paquete(s)..."` antes de llamar a `ejecutarAcciones`, por lo que los
  mensajes `"Enviando frameworks seleccionados..."` y `"Actualizando y enviando
  frameworks seleccionados..."` dentro de `ejecutarAcciones` eran redundantes.
  Eliminados.

### Changed
- [Jose] `ejecutarAcciones` — despacho de acciones refactorizado: el antiguo
  `Map` + 6 pases `filter().map()` (O(6n)) sustituido por un único bucle `switch`
  (O(n)), eliminando creación de estructuras intermedias.
- [Jose] `ejecutarAcciones` — `getAutor()` se llama una sola vez antes de los bloques
  de envío en lugar de dos veces (una por bloque). La llamada solo se realiza si hay
  algún paquete que enviar.
- [Jose] `ejecutarAcciones` — eliminadas las llamadas redundantes a
  `.filter(i => i.instalado && i.versionLatest !== undefined)` en el bloque
  `aEnviarConUpdate`: `tieneEnviarConUpdate` garantiza ambas condiciones y
  `construirInfoPaquetes` establece `versionLatest` siempre que `tieneUpdate = true`.
  Asimismo, el filtro en `aInstalar` se simplifica a `.filter(i => i.instalado)`.
- [Jose] `GestorTabla` — `slots` pre-calculado en el constructor y almacenado como
  `readonly`. `renderAcciones` ya no reconstruye el array en cada frame, reduciendo
  allocaciones durante el renderizado de la tabla.

---
## 2026.5.14+4

### Changed
- [Jose] `framework/gestor.ts` — `GestorTabla` acepta `soloUpdate = false` como segundo
  parámetro del constructor. En modo `soloUpdate`:
  - `accionesDisponibles` devuelve únicamente `[Nada, Actualizar]` por paquete.
  - `renderAcciones` muestra solo los slots `nada` y `actualizar`; se ocultan los de
    `desinstalar`, `resetear` y `enviar`.
  - Los atajos `r` (resetear todos) y `e` (enviar todos) se deshabilitan.
  - El separador horizontal se recalcula con el ancho reducido.
- [Jose] `framework/gestor.ts` — `GestorTabla.run(autoConfirmMs?)`: nuevo parámetro
  opcional de auto-confirmación. Si se pasa (e.g. `5000`), se inicia un temporizador que
  resuelve la promesa con las acciones actuales al expirar. El temporizador se cancela
  al primer keypress y aparece debajo de la tabla como `"Auto-confirma en Ns — pulsa
  cualquier tecla para cancelar"`, actualizándose cada segundo.
- [Jose] `framework/gestor.ts` — `actualizarTodo` sustituye el `checkbox` de
  `@inquirer/prompts` por `new GestorTabla(infos, true).run(5000)`: ahora comparte
  exactamente la misma tabla que el gestor interactivo principal, en modo restringido
  con cuenta atrás de 5 s.
- [Jose] Import de `checkbox` eliminado de `gestor.ts`.

---
## 2026.5.14+3

### Changed
- [Jose] `framework/gestor.ts` — `actualizarTodo(basedir, forzar = false)`: añadido parámetro
  `forzar`. Con `forzar = false` (por defecto) muestra un selector de tipo checkbox con los
  paquetes que tienen update pendiente, todos preseleccionados; si no hay interacción en 5
  segundos se confirma automáticamente. Con `forzar = true` salta el selector y actualiza todo
  directamente (comportamiento anterior de `--update`).
- [Jose] `clases/devel.ts` — `pull(basedir, false)` sustituido por `actualizarTodo(basedir)`:
  reutiliza la misma implementación con selector interactivo y timeout de 5 s.
- [Jose] `clases/update.ts` — `actualizarTodo(basedir)` cambiado a
  `actualizarTodo(basedir, true)`: modo silencioso para `yarn mrpack update`.
- [Jose] `modulos/framework.ts` — `actualizarTodo(this.root)` cambiado a
  `actualizarTodo(this.root, true)`: modo silencioso para `yarn mrpack framework --update`.

### Removed
- [Jose] `framework/paquetes.ts` eliminado: `pull` y `cargarTodosLosPaquetes` quedan
  absorbidos por `actualizarTodo`. Ya no existe implementación duplicada del ciclo de vida
  de actualización de paquetes.
- [Jose] `framework/index.ts` — eliminado el re-export de `pull`.

---
## 2026.5.14+2

### Changed
- [Jose] `clases/update.ts` — sustituida la llamada `pull(basedir, true)` por
  `actualizarTodo(basedir)`: reutiliza el mismo código que `yarn mrpack framework --update`,
  ganando paralelización completa, logs en `tmp/log/` y detección `soloInstalados`.
  El comportamiento observable es idéntico (actualiza todos los frameworks instalados sin
  interacción), pero el flujo interno es compartido.

---
## 2026.5.14+1

### Added
- [Jose] `framework/gestor.ts` — `escribirLog(basedir, info, entradas, logsRaw)`: escribe el
  resultado de cada `applyUpdate` en `{basedir}/tmp/log/{nombre}.log`. El fichero incluye un
  encabezado con la fecha, la versión de origen y la versión destino, el listado de ficheros
  afectados con prefijo `[OK   ]` / `[Error]` y, si los hay, la salida capturada del proceso.
  Si el fichero ya existía se sobreescribe. En consola solo se muestra un aviso con la ruta al
  log cuando hay conflictos de merge.
- [Jose] `paquete/file.ts` — `IUpdateTracker` exportado: interfaz mutable
  `{hayConflictos: boolean; entradas: {archivo: string; estado: "ok" | "error"}[]}` que fluye
  por todo el árbol de ficheros durante `checkCambios` y acumula cada fichero afectado.
- [Jose] `framework/gestor.ts` — parámetro `soloInstalados` en `construirInfoPaquetes`:
  cuando es `true` (usado en `--update`, `--send` y `--reset`) escanea los directorios locales
  en lugar de listar GCS, evitando llamadas de red innecesarias cuando ya se sabe que solo
  interesan los paquetes instalados.

### Changed
- [Jose] `framework/gestor.ts` — `const enum Accion` sustituye al antiguo `type Accion`:
  valores PascalCase (`Nada`, `Instalar`, `Actualizar`, `Resetear`, `Desinstalar`, `Enviar`,
  `EnviarConUpdate`) con strings en minúsculas como valores. Mejora la consistencia y la
  exhaustividad en tiempo de compilación.
- [Jose] `framework/gestor.ts` — `ejecutarAcciones`: todas las fases (bootstrap de instalación,
  instalaciones+actualizaciones, resets, desinstalaciones, envíos directos y `enviarConUpdate`)
  se ejecutan en paralelo con `Promise.all`. La llamada a `interceptOutput` fue eliminada, lo que
  hace posible la paralelización total sin interferencias entre paquetes.
- [Jose] `framework/gestor.ts` — `aEnviar`: se llama a `Paquete.setupConsolaParaUpdate` antes
  del `Promise.all` de envíos directos, de modo que cada paquete recicla su propia línea en
  consola (igual que ya hacían instalar/actualizar).
- [Jose] `framework/paquetes.ts` — paso 5 de `pull` paralelizado: las actualizaciones de
  los paquetes seleccionados se aplican con `Promise.all` en lugar de secuencialmente.
- [Jose] `paquete/index.ts` — `applyUpdate` devuelve `{cambio, conflictos, entradas}` (antes
  solo `{cambio, conflictos}`). Las `entradas` provienen del `IUpdateTracker` tras el merge.
- [Jose] `paquete/root.ts` — `actualizarVersion` devuelve
  `{actualizado, conflicto, entradas}` propagando el tracker completo.
- [Jose] `paquete/file.ts` — `checkCambios` sin `console.log`; `Colors` import eliminado.
- [Jose] `paquete/directory.ts` — `console.log` eliminado de la eliminación de directorios;
  `Colors` import eliminado.
- [Jose] `modulos/auto-doc.ts` — bug corregido: importaba `IConfigEjecucion` de `clases/devel`
  (que tiene `compilar/ejecutar/forzar`) en lugar del tipo correcto del propio módulo.
  `IAutoDoc` ahora solo extiende `IModulo` con `env?: string`; el bloque `parseParams`
  protege contra `undefined` con la rama `else { mostrarAyuda() }`.
- [Jose] `modulos/init.ts` y `modulos/update.ts` — interfaces `IInitConfig`/`IInit` y
  `IUpdateConfig`/`IUpdate` simplificadas: eliminados bloques `options` vacíos con comentarios
  e interfaces implícitas sin miembros.
- [Jose] Regla de estilo añadida al workspace: usar siempre `Tipo[]` en lugar de `Array<Tipo>`.
  El uso incorrecto en `gestor.ts` (`Array<{key: Accion; ancho: number}>`) fue corregido.

### Removed
- [Jose] `modulos/upload.ts` eliminado: el comando `yarn mrpack upload` ya no existe.
  `yarn mrpack framework --send` cubre el mismo caso de uso con mejor comportamiento
  (paralelización, logs de conflictos, detección automática de update previo).
- [Jose] `framework/paquetes.ts` — `push()` y `reset()` eliminadas (código muerto):
  `enviarTodo` en `gestor.ts` ofrece la misma funcionalidad con implementación completa.
- [Jose] `framework/index.ts` — eliminado el re-export de `reset` (ya no existe en `paquetes.ts`).

---
## 2026.5.13+9

### Added
- [Jose] `mrpack framework --send` / `-s`: envía todos los paquetes con cambios locales sin
  interacción del usuario. Si un paquete tiene un update remoto pendiente, primero aplica el
  update (merge 3-way); si el merge no genera conflictos continúa con el envío; si genera
  conflictos omite el envío de ese paquete y continúa con los demás.
- [Jose] `framework/gestor.ts` — `enviarTodo(basedir)`: función exportada que construye el
  mapa de acciones (`enviar` / `enviarConUpdate` / `nada`) de forma automática y delega en
  `ejecutarAcciones`.

### Changed
- [Jose] `framework/gestor.ts` — `tieneEnviar` y `tieneEnviarConUpdate` son ahora `public static`
  para poder ser referenciadas desde `enviarTodo` sin duplicar la lógica de condición.
- [Jose] `modulos/framework.ts` — añadido flag `--send` (`-s`); la firma de `IFrameworkConfig`
  e `IFramework` se amplían correspondientemente; el texto de ayuda incluye la nueva opción.
- [Jose] `README.md` — sección `framework` actualizada con el nuevo flag `-s`/`--send`.

---
## 2026.5.13+8

### Added
- [Jose] `framework/gestor.ts` — nueva acción `"enviarConUpdate"`: proceso de dos pasos que
  primero aplica el update remoto pendiente y, si no se generan conflictos en el merge, envía
  los cambios locales automáticamente. Se muestra en **cyan** en la tabla interactiva con el
  texto `"actualizar+enviar"`.
- [Jose] `paquete/index.ts` — `_prebaked`: cache interna de
  `{status, hayCambios, versionBase}` que se rellena durante `checkCambiosLocales()` y se
  consume en `push()`, evitando una segunda descarga de GCS y un segundo escaneo del árbol de
  ficheros. Se invalida automáticamente tras un `applyUpdate`.
- [Jose] `paquete/index.ts` — `invalidarCacheVersion()`: limpia `_latestCache` para forzar una
  consulta fresca a GCS y poder detectar si otra persona ha publicado entre medias.
- [Jose] `paquete/root.ts` — `actualizarAutor(versionBase, autor)`: recalcula el campo `version`
  a partir de la versión base sin volver a escanear el árbol de ficheros.
- [Jose] `framework/gestor.ts` — verificación de versión remota antes de ejecutar: tras la
  selección del usuario y antes de aplicar las acciones, se consulta la versión remota actual de
  cada paquete marcado para envío. Si ha cambiado, se muestra un aviso `⚠` y se recarga la tabla
  para que el usuario vuelva a elegir.

### Changed
- [Jose] `utiles/merge.ts` — `merge3` devuelve `{text: string; conflict: boolean}` en lugar
  de `string`, permitiendo propagar hacia arriba si la mezcla generó secciones en conflicto.
- [Jose] `paquete/file.ts` — `mezclar()` devuelve `{hash, conflict}`. `checkCambios()` acepta
  un `tracker?: {hayConflictos: boolean}` opcional que se rellena si la mezcla 3-way genera
  conflictos.
- [Jose] `paquete/directory.ts` — `checkCambiosEjecutar` y `checkCambios` aceptan el mismo
  `tracker?` y lo propagan en todas las llamadas recursivas y a `file.checkCambios`.
- [Jose] `paquete/root.ts` — `actualizarVersion` devuelve `{actualizado: boolean; conflicto: boolean}`
  en lugar de `boolean`. Crea internamente el `tracker` y lo pasa a `checkCambios`.
- [Jose] `paquete/index.ts` — `applyUpdate` devuelve `{cambio: boolean; conflictos: boolean}`.
  Si `conflictos === true` el gestor no realiza el push posterior.
- [Jose] `framework/gestor.ts` — `defaultAccion` simplificada: la acción por defecto es
  `"actualizar"` si hay update remoto, o `"nada"` en cualquier otro caso. Las acciones
  `"enviar"` y `"enviarConUpdate"` ya no se preseleccionan automáticamente; el usuario debe
  elegirlas explícitamente (tecla `e` o navegación con `←`/`→`).
- [Jose] `framework/gestor.ts` — `tieneEnviarConUpdate()` sustituye a `enviarBloqueado()`;
  la celda `"enviar"` roja ya no existe: cuando hay update pendiente + cambios locales la acción
  disponible es directamente `"enviarConUpdate"`. La tecla `e` selecciona `"enviarConUpdate"` o
  `"enviar"` según corresponda.
- [Jose] `framework/gestor.ts` — `construirInfoPaquetes` acepta el parámetro opcional
  `checkCambios = true`; los modos no interactivos (`actualizarTodo`, `resetearTodo`) lo pasan
  a `false` para saltarse el costoso ciclo de normalización de hash.
- [Jose] `framework/paquetes.ts` — adaptado para usar `(await paquete.applyUpdate(latest)).cambio`.

---
## 2026.5.13+7

### Added
- [Jose] `mrpack framework --update` / `-u`: actualiza todos los paquetes con versión remota
  disponible sin mostrar el gestor interactivo. Equivale a abrir el gestor con `actualizar`
  preseleccionado en todos los paquetes aplicables y confirmar con Intro.
- [Jose] `mrpack framework --reset` / `-r`: resetea todos los paquetes instalados a su versión
  publicada sin interacción. Equivale a abrir el gestor con `resetear` preseleccionado en todos.
- [Jose] `framework/gestor.ts` — `actualizarTodo(basedir)` y `resetearTodo(basedir)`:
  funciones exportadas que construyen el mapa de acciones automáticamente y delegan en la
  nueva función interna `ejecutarAcciones`.

### Changed
- [Jose] `framework/gestor.ts` — la lógica de ejecución de `gestionar` extraída a la función
  privada `ejecutarAcciones(basedir, infos, accionesArr)` para evitar duplicación entre el
  flujo interactivo y los nuevos modos no interactivos.
- [Jose] `modulos/framework.ts` — añadidos flags `--update` (`-u`) y `--reset` (`-r`);
  la firma de `IFrameworkConfig` e `IFramework` se amplían correspondientemente.
- [Jose] `README.md` — sección `framework` actualizada con la tabla de opciones y ejemplos.

---
## 2026.5.13+6

### Added
- [Jose] `paquete/index.ts` — `checkCambiosLocales()`: detecta si el árbol de ficheros local
  difiere del último estado publicado en GCS, replicando exactamente el proceso de `push`
  (normaliza `package.json` a `"0.0.0+0"`, llama a `crearVersion` y restaura el fichero en `finally`).
- [Jose] `paquete/index.ts` — `calcularHashCambiado(status, autor)`: método privado compartido
  por `push` y `checkCambiosLocales` para evitar duplicar la lógica de normalización del hash.

### Changed
- [Jose] `paquete/index.ts` — `getLatest()` cachea su `Promise` en `_latestCache` para evitar
  una segunda petición a GCS cuando se encadena `checkUpdate()` + `getVersionRemota()`.
- [Jose] `paquete/index.ts` — `anticuado` y `adelantado` refactorizados usando el nuevo método
  estático privado `compararVersiones`, eliminando la duplicación de la lógica de parsing semver.
- [Jose] `paquete/index.ts` — `loadAll` paraleliza el escaneo de los tres directorios
  (`@mr/core`, `@mr/user`, `framework`) con `Promise.all`.
- [Jose] `framework/gestor.ts` — `tieneEnviar` y `enviarBloqueado` requieren `tieneCambiosLocales === true`
  (antes podían activarse sin cambios locales reales).
- [Jose] `framework/gestor.ts` — `construirInfoPaquetes` ejecuta `checkUpdate` y `checkCambiosLocales`
  en paralelo por paquete con `Promise.all`.
- [Jose] `init.ts` — las dos llamadas a `resolverDepsTransitivas` (para `dependencies` y
  `optionalDependencies`) ahora corren en paralelo con `Promise.all`.
- [Jose] `@mr/core/network/server/http/conexion.ts` — `post` acepta también `unknown[]`
  además de `NodeJS.Dict<unknown>`.

### Refactored
- [Jose] `clases/framework.ts` dividido en cuatro submódulos bajo `clases/framework/`:
  - `cliente.ts` — `add`, `remove`, `getClienteHash`, `getClienteMD5`, `checkCliente`,
    `recompilarCliente`, `getAutor`, `pullPackage`.
  - `paquetes.ts` — `cargarTodosLosPaquetes` (privada), `pull`, `push`, `reset`.
  - `gestor.ts` — `listarNombresGCS`, `IPaqueteGestion`, `GestorTabla`,
    `construirInfoPaquetes`, `gestionar`.
  - `index.ts` — barrel que re-exporta todo lo anterior.
  - El fichero `clases/framework.ts` ha sido eliminado; la resolución de módulos de
    TypeScript/Node resuelve `from "./framework"` automáticamente a `framework/index.ts`.
  - Todos los consumidores existentes (`devel.ts`, `update.ts`, `init.ts`,
    `modulos/upload.ts`, `modulos/framework.ts`) funcionan sin cambios.

### Fixed
- [Jose] `framework` — la opción `enviar` aparecía en paquetes sin cambios locales reales.
  La causa era que el hash se comparaba con el `package.json` real (`2026.x.y+N`), pero el
  hash stored en GCS fue calculado con la versión normalizada `"0.0.0+0"`. Corregido con
  `calcularHashCambiado`, que replica exactamente el proceso de `push`.

---
## 2026.5.13+5

### Added
- [Jose] `framework.ts` — columna extra `enviar` en la tabla interactiva de `gestionar()`:
  - La columna solo aparece si al menos un paquete instalado tiene su versión local diferente
    a la remota (local ≠ latest), indicando cambios pendientes de publicar.
  - Por fila: si el paquete tiene cambios y no hay update pendiente → checkbox `○`/`◉` en verde
    seleccionable con la tecla `e`. Si el paquete tiene un update remoto pendiente (`tieneUpdate`)
    → celda `⊘ enviar` en rojo, visible pero no seleccionable.
  - Al confirmar con Intro, los paquetes marcados se envían secuencialmente con `paquete.push(autor)`
    (el autor se obtiene de `git config user.name`).
  - Atajo `e`: alterna el estado de envío del paquete activo (solo si está disponible).
  - El ancho del separador se recalcula incluyendo la nueva columna.

---
## 2026.5.13+4

### Changed
- [Jose] `init.ts` — `resolverDepsTransitivas` acepta nuevo parámetro `campo`
  (`"dependencies"` | `"optionalDependencies"`, por defecto `"dependencies"`), permitiendo
  reutilizar el mismo recorrido recursivo para ambos tipos de dependencias.
- [Jose] `init.ts` — `initWorkspace` propaga también las `optionalDependencies` de los
  paquetes `@mr/*` declarados como devDependencies:
  - Se lanza `resolverDepsTransitivas(..., "optionalDependencies")` con un `Set` de visitados
    independiente del de `dependencies` y se fusiona el resultado en `paquete.optionalDependencies`.
  - Tras fusionar las `dependencies` transitivas en `paquete.dependencies`, se elimina
    `bufferutil` de `paquete.dependencies` si existía (ya sea por propagación transitiva o
    por declaración previa en el propio `package.json`), ya que este módulo nativo solo debe
    aparecer en `optionalDependencies`.
  - Si `paquete.optionalDependencies` queda vacío tras la fusión, se elimina el campo.

---
## 2026.5.13+3

### Added
- [Jose] `framework.ts` — gestor interactivo `gestionar(basedir)` con tabla ANSI completa:
  - Columnas: `tipo` | `nombre` | `instalada` | `disponible` | radio buttons de acción.
  - Paquetes incluidos: `@mr/cli`, `@mr/core/*` (desde GCS), `@mr/user/*` (desde GCS) y
    `framework/services-*` (solo los ya instalados localmente, tipo `legacy`).
  - Radio buttons con slots fijos en orden `nada | actualizar/instalar | desinstalar | resetear`.
    Si ningún paquete tiene la opción `actualizar/instalar`, la columna se oculta completamente.
    Si la opción no aplica a un paquete concreto, se reserva el hueco para mantener la alineación.
  - Acciones disponibles según estado del paquete:
    - `nada`: siempre disponible; es la acción por defecto salvo en paquetes instalados con update.
    - `instalar` / `actualizar`: solo si hay versión remota más reciente disponible.
    - `desinstalar`: solo si está instalado y no es `@mr/cli` ni `legacy`.
    - `resetear`: solo si está instalado.
  - Atajos de teclado globales: `n` → nada en todos, `a` → actualizar en todos, `r` → resetear en todos.
  - Línea de ayuda separada con `│` entre grupos de atajos.
  - Anchos de columna `tipo` y `nombre` calculados dinámicamente (mínimo `"tipo".length` / `"nombre".length`).
- [Jose] `framework.ts` — `listarNombresGCS(subdir, bucket?)`: lista prefijos GCS bajo `@mr/core/` y `@mr/user/`.
- [Jose] `framework.ts` — `construirInfoPaquetes(basedir, bucket?)`: carga en paralelo el estado
  completo de todos los paquetes (versión local + versión remota vía `checkUpdate` / `getVersionRemota`).
- [Jose] `paquete/index.ts` — `Paquete.buildVirtual(npmName, tipo, bucket?)`: crea una instancia sin
  `package.json` local, útil para paquetes no instalados.
- [Jose] `paquete/index.ts` — `Paquete.formatVersion(v)`: expone `maquetarVersion` de forma estática.
- [Jose] `paquete/index.ts` — `get versionPublica()`: getter público para `this.version`.
- [Jose] `paquete/index.ts` — `getVersionRemota()`: llama a `getLatest()` de forma pública.

### Changed
- [Jose] `mrpack/modulos/framework.ts` — eliminadas todas las opciones (`--add`, `--list`, `--remove`,
  `--repository`, `--reset`, `--update`); el comando sin argumentos abre directamente `gestionar()`.
- [Jose] `README.md` — sección `framework` reescrita reflejando el nuevo gestor interactivo:
  tabla de columnas, acciones, navegación, tipos de paquete y atajos de teclado.

---
## 2026.5.13+2

### Added
- [Jose] `framework.ts` — `add(basedir, frameworks[])` implementado:
  - Detecta el tipo de paquete a partir del nombre: `@mr/core/<name>` → `core`,
    `@mr/user/<name>` → `user`, resto → `legacy`.
  - Crea el directorio y el `package.json` mínimo si no existen y llama a `pullPackage`
    para descargar la última versión desde el bucket GCS.
- [Jose] `init.ts` — resolución de dependencias transitivas durante el `init`:
  - Nueva función `resolverDepsTransitivas(root, devDeps, visitados)`: recorre de forma
    recursiva todos los `devDependencies` con nombre `@mr/*`, lee su `package.json`,
    acumula sus `dependencies` de producción y repite el proceso para sus propias `@mr/*`
    devDependencies. Usa un `Set` de visitados para evitar referencias circulares.
  - Nueva función `mrNombreADir(root, nombre)`: traduce `@mr/core-X` → `@mr/core/X`,
    `@mr/user-X` → `@mr/user/X`, `@mr/cli` → `@mr/cli`.
  - Nueva función `versionMasReciente(a, b)`: compara dos rangos semver y devuelve el
    más reciente; si alguno es `*`, prefiere el otro.
  - En `initWorkspace`, tras `checkDependencies`, se llaman las funciones anteriores y se
    fusionan las dependencias propagadas en `paquete.dependencies`.

### Changed
- [Jose] `paquete/index.ts` — `PaqueteTipo.client` renombrado a `PaqueteTipo.user`; el
  repo de los paquetes de tipo `user` pasa de `@mr/client/<name>` a `@mr/user/<name>`.
- [Jose] `paquete/index.ts` — `loadAll` incluye ahora `@mr/user/*` además de `@mr/core/*`.
- [Jose] `framework.ts` — `cargarTodosLosPaquetes` incluye ahora `@mr/user/*`.
- [Jose] `framework.ts` — `list()` case `client` renombrado a `user`; subdir `@mr/client` → `@mr/user`.
- [Jose] `init.ts` — el bootstrap de paquetes en `checkCliente` usa `add()` en lugar de
  los tres bloques manuales de `mkdir` + `safeWrite` + `pullPackage`.
- [Jose] `rspack.config.ts` — si `package.json` devuelve `null`, lanza un `Error` explícito
  con la ruta afectada (antes se propagaba con `?.`).

---
## 2026.5.13+1

### Added
- [Jose] Creado `README.md` del paquete con documentación completa del ejecutable `mrpack`:
  tabla de módulos, opciones por módulo, ejemplos de uso y referencia rápida.
- [Jose] `paquete/index.ts` — nuevos métodos públicos sobre `Paquete`:
  - `checkUpdate()` — comprueba si existe una versión remota más reciente sin descargar el ZIP.
  - `applyUpdate(latest)` — descarga y aplica la actualización con captura de salida (ver Changed).
  - `etiquetaUpdate(latest, padding?)` — genera la etiqueta formateada para el selector de actualización.
  - `setupConsolaParaUpdate(paquetes[])` — configura el display de cursor dinámico para N paquetes.

### Changed
- [Jose] `framework.ts` — rediseño completo del flujo `pull`:
  - **Fase 1 (paralela):** comprueba actualizaciones de todos los paquetes (`@mr/cli` + `@mr/core/*` +
    `framework/*`) simultáneamente, solo descargando `stable.txt` por paquete.
  - **Fase 2 (selector):** muestra un `checkbox` interactivo con los paquetes pendientes; el nombre
    completo con versiones (`name`) se muestra durante la selección, y solo el nombre del paquete
    (`short`) aparece en el resumen tras confirmar. Temporizador de 5 s cancelable al primer keypress.
  - **Fase 3 (secuencial):** aplica actualizaciones una a una, capturando la salida de cada paquete
    en `paquete.logs` para no romper el display de progreso.
  - **Fase 4 (logs):** muestra un resumen `Registros del proceso de actualización` por paquete con
    los mensajes capturados, si los hay.
  - Con `--forzar` se omite el selector y se actualizan todos los paquetes pendientes directamente.
  - Eliminadas las funciones `pullPackage` (helpers internas de la fase de comprobación),
    `pullCore` y `pullLegacy`; `pullPackage` se mantiene exportada para uso de `mrpack init`.
- [Jose] `paquete/index.ts` — `applyUpdate` intercepta `process.stdout.write` y
  `process.stderr.write` durante su ejecución: solo deja pasar la salida originada en `consola()`
  (marcada con el flag `consolaEscribiendo`); el resto se acumula en `this.logs`.
- [Jose] `rspack.config.mjs` — añadidos `typescript` y `ts-checker-rspack-plugin` a los externals
  para evitar que rspack los empaquete y eliminar el warning *"Critical dependency: the request of
  a dependency is an expression"* de `typescript.js`.

---
## 2026.5.6+1

### Added
- [Jose] Documentación JSDoc completa del directorio `manifest/`: interfaces `IManifest`, `Manifest`, `IManifestDeployment`, `ManifestDeployment`, `IManifestDeploymentBuild`, `ManifestDeploymentBuild`, `IManifestDeploymentRun` y `ManifestDeploymentRun`
- [Jose] Creado `manifest/README.md` con esquema JSON, tablas de propiedades, valores por defecto y variables de entorno

### Changed
- [Jose] Refactorizadas las clases solo-static a funciones de módulo para mayor claridad y eficiencia:
  - `yarn.ts`: `class Yarn` → `export function install` / `export function update`
  - `framework.ts`: `class Framework` → funciones exportadas individuales
  - `update.ts`: `class Update` → `export async function init`
  - `devel.ts`: `class Devel` → `export function run`
  - `auto-doc.ts`: `class AutoDoc` → `export function run`
  - `comando.ts`: `class Comando` → `export async function Comando`
  - `log.ts`: `class Log` → `export const Log` (objeto exportado)
- [Jose] Eliminados todos los dynamic imports (`await import(...)`) de `src/mrpack`, reemplazados por imports estáticos
- [Jose] Sustituidos todos los `import * as Namespace` por imports nombrados individuales
- [Jose] `MODULOS` en `mrpack.ts` declarado `as const` para garantizar exhaustividad en tiempo de compilación

### Fixed
- [Jose] El destruturing del `Promise.all` de 3 elementos en `devel.ts` capturaba solo 2 variables; corregido a `[core, framework, packages]`
- [Jose] Servicio con error nunca se reiniciaba: `this.ejecucion` no se reseteaba antes del `setTimeout`; corregido
- [Jose] `webpackChunkName` incorrecto en `modulos/deploy.ts`: `"mrpack/devel"` → `"mrpack/deploy"`
- [Jose] Ayuda duplicada en `auto-doc.ts`: llamada doble a `mostrarAyuda()`
- [Jose] Doble asignación `i18n = i18n = new I18N(...)` en `devel.ts`
- [Jose] Texto de descripción erróneo en `modulos/framework.ts` mostraba `deploy` en lugar de `framework`
- [Jose] Watcher de `config.workspaces.json` en `devel.ts` sin `.catch()`
- [Jose] Proceso hijo en `comando.ts` sin handler `"error"` en el evento del proceso
- [Jose] `if (devel.enabled)` ignoraba `false` explícito en `root/deploy/build.ts`, `root/deploy/run.ts` y `workspace/development.ts`; corregido a `!== undefined`
- [Jose] `root/deploy/run.ts` comprobaba `enabled` dos veces; segunda comprobación corregida a `latest`

### Removed
- [Jose] Eliminado fichero huérfano `clases/service.ts` con interfaces duplicadas
- [Jose] Eliminado bloque Dockerfile PHP duplicado en `workspace/compilar.ts`
- [Jose] Eliminados bloques de código comentado obsoleto en `devel.ts`
- [Jose] Eliminada rama `default` inalcanzable en `mrpack.ts`

---
## 2026.1.7+1
- [Juan Carlos] Soporte a la versión 16 de NextJS.

---
## 2025.9.24+1

### Changed
- [Jose] Soporte multiarquitectura amd64/arm64 para Docker.

---
## 2025.7.28+1

### Updated
- [Juan Carlos] Se añade el patrón `**/coverage/**` al archivo `.gitignore` para evitar que se suba el directorio de cobertura de tests.

---
## 2025.7.23+1

### Updated
- [Jose] En el manifiesto de workspace, cuando se definen los buckets de storage en los que desplegar el código ahora se distingue entre producción y test (por defecto el mismo bucket)

---
## 2025.7.21+1

### Updated
- [Jose] MRPack y MRLang ahora se compilan utilizando RSPack en lugar de Webpack lo que reduce el tiempo de compilación

---
## 2025.5.21+1

### Updated
- [Jose] Update de librerías:
    - [@types/node](https://www.npmjs.com/package/@types/node) 22.15.21
    - [webpack](https://www.npmjs.com/package/webpack) 5.99.9

---
## 2025.5.13+1

### Updated
- [Juan Carlos] Update de librerías:
    - [@types/node](https://www.npmjs.com/package/@types/node) 22.15.17
    - [sass](https://www.npmjs.com/package/sass) 1.88.0
    - [webpack](https://www.npmjs.com/package/webpack) 5.99.8

---
## 2025.5.8+1

### Updated
- [Juan Carlos] Update de librerías:
  - [mysql2](https://www.npmjs.com/package/mysql2) 3.14.1
  - [@types/node](https://www.npmjs.com/package/@types/node) 22.15.16


---
## 2025.3.24+1

### Fixed
- [Jose] Se ha eliminado el contenido de `assets`, `output` y `.next` de los archivos supervisados por watch
- [Jose] Se ha silenciado los warnings cuando se ejecuta en producción/test

### Updated
- [Jose] Update de librerías:
    - [@inquirer/prompts](https://www.npmjs.com/package/@inquirer/prompts) 7.4.0
    - [@tsconfig/node22](https://www.npmjs.com/package/@tsconfig/node22) 22.0.1
    - [@types/node](https://www.npmjs.com/package/@types/node) 22.13.13
    - [mysql2](https://www.npmjs.com/package/mysql2) 3.14.0
    - [sass](https://www.npmjs.com/package/sass) 1.86.0

---
## 2025.3.14+1

### Added
- [Juan Carlos] Se añade soporte a workspaces tipo `scripts` para compilar y ejecutar en desarrollo.

---
## 2025.3.13+1

### Fixed
- [Jose] Se ha corregido una reescritura innecesaria del mrpack.json en cada inicio de compilación
- [Jose] Se ha ignorado los directorios de output, files, assets y .next del filewatcher

---
## 2025.3.12+1

### Changed
- [Jose] Update de librerías:
    - [webpack-manifest-plugin](https://www.npmjs.com/package/webpack-manifest-plugin) 5.0.1
- [Jose] Se ha revisado el archivo `.mr-ignore` dentro de `@mr/cli/bin`
- [Jose] Se ha desactivado la subida descomprimida a los repositorios antiguos

### Fixed
- [Jose] Cuando se añaden credenciales durante la compilación, se crea la ruta del destino por si se encontrara fuera
  del directorio por defecto

---
## 2025.3.10+1

### Changed
- [Jose] Update de librerías:
    - [@inquirer/prompts](https://www.npmjs.com/package/@inquirer/prompts) 7.3.3
    - [@types/node](https://www.npmjs.com/package/@types/node) 22.13.10

---
## 2025.3.7+1

### Changed
[Jose] Limpieza de propiedades vacías en el `package.json` raiz

---
## 2025.3.6+1

### Changed
- [Juan Carlos] Update de librerías:
    - [mysql2](https://www.npmjs.com/package/mysql2) 3.13.0
      [Jose] Añadido soporte a cluster multicliente durante el despliegue (para mrpress)

---
## 2025.3.5+1

### Changed
- [Jose] Se ha añadido la opción `defaultLogsBucketBehavior` a la configuración de despliegue
- [Jose] Se ha simplificado la configuración de despliegue
- [Jose] Si no se encuentra información de kustomización, se ignora el workspace en lugar de generar un error

---
## 2025.2.28+1

### Changed
- [Jose] Update de librerías:
    - [terser-webpack-plugin](https://www.npmjs.com/package/terser-webpack-plugin) 5.3.12

---
## 2025.2.27+1

### Changed
- [Jose] Refactorizada la propiedad deploy.kustomize de mrpack.json para soportar próximos cambios

---
## 2025.2.26+1

### Updated
- [Jose] Añadidas dependencias:
    - [dotenv](https://www.npmjs.com/package/dotenv) 16.4.7

### Changed
- [Jose] Se ha refactorizado los scripts de despliegue
    - Ahora se puede compilar y no desplegar, desplegar sin compilar, forzar una nueva versión de despliegue y
      actualizar el despliegue a la versión más reciente

---
## 2025.2.24+1

### Updated
- [Juan Carlos] Update de librerías:
    - [@google-cloud/storage](https://www.npmjs.com/package/@google-cloud/storage) 7.15.2
    - [sass](https://www.npmjs.com/package/sass) 1.85.0
    - [sass-loader](https://www.npmjs.com/package/sass-loader) 16.0.5
    - [webpack](https://www.npmjs.com/package/webpack) 5.98.0

---
## 2025.3.5+1

### Changed
- [Jose] Se ha añadido la opción `defaultLogsBucketBehavior` a la configuración de despliegue

---
## 2025.2.28+1

### Changed
- [Jose] Update de librerías:
    - [terser-webpack-plugin](https://www.npmjs.com/package/terser-webpack-plugin) 5.3.12

---
## 2025.2.27+1

### Changed
- [Jose] Refactorizada la propiedad deploy.kustomize de mrpack.json para soportar próximos cambios

---
## 2025.2.26+1

### Updated
- [Jose] Añadidas dependencias:
    - [dotenv](https://www.npmjs.com/package/dotenv) 16.4.7

### Changed
- [Jose] Se ha refactorizado los scripts de despliegue
    - Ahora se puede compilar y no desplegar, desplegar sin compilar, forzar una nueva versión de despliegue y
      actualizar el despliegue a la versión más reciente

---
## 2025.2.24+1

### Updated
- [Juan Carlos] Update de librerías:
    - [@google-cloud/storage](https://www.npmjs.com/package/@google-cloud/storage) 7.15.2
    - [sass](https://www.npmjs.com/package/sass) 1.85.0
    - [sass-loader](https://www.npmjs.com/package/sass-loader) 16.0.5
    - [webpack](https://www.npmjs.com/package/webpack) 5.98.0

---
## 2025.2.4+1

### Added
- [Jose] Se ha añadido manifiesto raiz de proyecto, orientado a configurar la construcción y despliegue del proyecto para producción/test de cara a la herramienta ci/cd

### Changed
- [Jose] Se ha limpiado las variables del proceso de despliegue
- [Jose] Se ha eliminado la necesidad de (des)autorizar antes de desplegar

---
## 2025.1.31+1

### Changed
- [Jose] Refactorizado el directorio `@mr/cli/manifest` a `@mr/cli/manifest/workspace` para dejar espacio a otros tipos de manifest
  - Se mantiene el la importación desde `@mr/cli/manifest` ya que solo será interesante exportar el manifiesto de workspaces

---
## 2025.1.30+1

### Changed
- [Jose] Se ha cambiado la estructura de la configuración de los workspaces, ahora en lugar de definirse dentro del archivo package.json se definen dentro del archivo mrpack.json ubicado en la raiz de cada workspace
  - Se puede obtener la referencia de la estructura de los archivos `mrpack.json` en [manifest/workspace/index.md](manifest/workspace/index.md)

---
## 2025.1.24+1

### Changed
- [Jose] Añadida estructura de nuevo archivo de manifiesto para los workspaces
- [Jose] Se ha cambiado las dependencias de mrpack para hacer la antigua interfaz Legacy
- [Jose] Se exporta la interfaz y clases para el nuevo manifiesto para poder leer el manifiesto desde los workspaces

---
## 2025.1.20+1

### Changed
- [Jose] Se ha separado los workspaces de `servicios` de los workspaces de `cronjobs`, ahora cada uno puede estar en su respectivo directorio
  - Por el momento pueden convivir mezclados tanto en el directorio `services` como en el directorio `cronjobs`

### Breaking Changes
- [Jose] El argumento pasado al Dockerfile `ws` se ha cambiado a `WS` (en mayúsculas). Si se ha creado un custom Dockerfile entonces hay que modificarlo en consecuencia

---
## 2025.1.16+5

### Updated
- [Juan Carlos] Update de librerías:
  - [chokidar](https://www.npmjs.com/package/chokidar) 4.0.3

---
## 2025.1.9+1

### Updated
- [Jose] Update de librerías:
    - [@google-cloud/storag](https://www.npmjs.com/package/@google-cloud/storag) 7.15.0
    - [@inquirer/prompts](https://www.npmjs.com/package/@inquirer/prompts) 7.2.1
    - [webpack-cli](https://www.npmjs.com/package/webpack-cli) 6.0.1
---
## 2024.12.16+1

### Updated
- [Jose] Update de librerías:
    - [@types/node](https://www.npmjs.com/package/@types/node) 22.10.2
    - [sass](https://www.npmjs.com/package/sass) 1.83.0

---
## 2024.12.10+1

### Updated
- [Jose] Update de librerías:
    - [@inquirer/prompts](https://www.npmjs.com/package/@inquirer/prompts) 7.2.0
    - [webpack](https://www.npmjs.com/package/webpack) 5.97.1

---
## 2024.12.4+1

### Changed
- [Jose] El archivo tsconfig.json ya no depende de services-comun
- [Jose] Añadida librería:
    - [@tsconfig/node22](https://www.npmjs.com/package/@tsconfig/node22) 22.0.0
- [Jose] Los binarios del `cli` ahora también se comparten cuando se sube una nueva versión
- [Jose] Se ha añadido la posibilidad de marcar ficheros/directorios como binarios para que no se mezclen sino que se sustituyan

### Updated
- [Jose] Update de librerías:
    - [sass](https://www.npmjs.com/package/sass) 1.82.0
    - [sass-loader](https://www.npmjs.com/package/sass-loader) 16.0.4

---
## 2024.12.3+1

### Updated
- [Jose] Update de librerías:
    - [sass](https://www.npmjs.com/package/sass) 1.81.1
    - [webpack](https://www.npmjs.com/package/webpack) 5.97.0

---
## 2024.11.28+1

### Updated
- [Jose] Update de librerías:
    - [@types/node](https://www.npmjs.com/package/@types/node) 22.10.1

---
## 2024.11.26+3

### Changed
- [Jose] Ahora se autoselecciona la versión LTS de node al abrir la consola

---
## 2024.11.26+1

### Updated
- [Jose] Update de librerías:
    - [@types/node](https://www.npmjs.com/package/@types/node) 22.10.0

---
## 2024.11.25+1

### Updated
- [Jose] Update de librerías:
    - [@types/node](https://www.npmjs.com/package/@types/node) 22.9.3
    - [typescript](https://www.npmjs.com/package/sass) 5.7.2

---
## 2024.11.18+1

### Changed
- [Jose] Se ha modificado los scripts internos del Cli
  - El script de actualización ya no da error

---
## 2024.11.15+1

### Changed
- [Jose] Revisado el loader de las herramientas para que detecte errores en el ejecutable y fuerce la recompilación

### Fixed
- [Jose] Fijada la librería [@elastic/elasticsearch](https://www.npmjs.com/package/@elastic/elasticsearch) a la versión `8.15.2` dado que la versión nueva `8.16.0` da errores de tipado

### Updated
- [Jose] Update de librerías:
    - [sass](https://www.npmjs.com/package/sass) 1.81.0

---
## 2024.11.14+1

### Changed
- [Jose] Correcciones visuales

---
## 2024.11.13+27

### Changed
- [Jose] Mejoras visuales del Cli

---
## 2024.11.13+26

### Fixed
- [Jose] Se han corregido muchos errores a la hora de actualizar el packaje.json del propio Cli

---
## 2024.11.13+1

### Updated
- [Jose] Update de librerías:
  - [sass](https://www.npmjs.com/package/sass) 1.80.7

---
## 2024.11.12+6

### Added
- [Jose] Añadida opción para listar frameworks
  ```bash
    yarn mrpack framework --list=<client|core|legacy> [--repository={bucket}]
  ```

---
## 2024.11.12+1

### Fixed
- [Jose] Ya se puede resetear el Cli
  - Cuando se resetea el Cli se comprueba si la versión compilada se corresponde con el código fuente actual y se reinicia el reseteo en caso de tener una versión nueva, así se hará el reseteo con una versión compilada actualizada
- [Jose] Cuando se actualiza el Cli, solo se reinicia el proceso si la nueva versión compilada ha cambiado respecto a la versión compilada anterior
- [Jose] Ya se envían, actualizan y resetean todos los FW con el código nuevo

---
## 2024.11.11+6

### Fixed
- [Jose] Corregida la detección de versión anterior para incrementar la versión

---
## 2024.11.11+5

### Fixed
- [Jose] Ahora se comprueba que el cli está compilado con el código actual evitando que el código se quede anticuado al actualizar el código por el commit de otra persona en git
- [Jose] Se ha añadido soporte varios formatos de frameworks (root, core, client y legacy)

---
## 2024.11.11+4

### Fixed
- [Juan Carlos] Corregido error al generar traducciones. Cuando no existía el idioma, en lugar de coger las traducciones del padre, se estaban cogiendo las "defecto".

---
## 2024.11.11+1

### Added
- [Jose] Se ha implementado la corrección de errores de GIT relacionados con cambios entre mayúsculas y minúsculas

---
## 2024.11.7+1

### Changed
- [Jose] Se ha reimplementado el PULL y PUSH del Cli:
  - Ahora se puede indicar el bucket al que sincronizar
  - Ahora en el bucket se almacenan copias versionadas en formato zip
  - Ahora al hacer un PULL se descarga la última versión del bucket además de la versión actual sin modificar para verificar los cambios a la hora de hacer el merge
  - Ahora se puede hacer PUSH y PULL en Windows (Beta), de momento solo para el caso del Cli
  - Ya no se utiliza el comando gsutil para interactuar con el almacén de Google Cloud
  - De momento se mantiene el PUSH antiguo para el cli, para que los proyectos puedan actualizarse al nuevo Cli
  - Se ha desactivado la opción de Reset para el caso del Cli
  - Se ha desactivado las opciones de Add y Remove para añadir y eliminar frameworks
  - Las releases ahora incluyen el nombre de git de quien la sube
  - Eliminada la necesidad de mantener en el repositorio el archivo status.json
  - Cuando se compila el proyecto, ahora se da la opción de no actualizar el Cli si hay una nueva versión
  - Se cambia `node:fs.watch` por `chokidar.watch` ya que mejora el rendimiento
  - Se ha renombrado el script para regenerar el Cli, para diferenciarlo del compilador de los proyectos

---
## 2024.10.30+1

### Fixed
- [Jose] Corregida la detección erronea de cambios en i18n que regeneraba las traducciones sin parar

---
## 2024.10.29+1

### Added
- [Jose] Añadida documentación de opciones de `mrpack` en el archivo [`scripts.md`](./scripts.md)
- [Jose] Añadida opción para resetear los frameworks a la versión publicada (descarta los cambios locales)
  ```bash
    yarn mrpack framework --reset
  ```

### Changed
- [Jose] Forzado el tipado de `node` a la versión `^22`

### Deleted
- [Jose] Eliminado el atajo `Doctor` que no se utilizaba
    - Se sigue pudiendo invocar con el comando `yarn run doctor`

### Fixed
- [Jose] Corregido error que hacía los nuevos archivos se interpretaran como directorios por lo que daban error al descargar

### Updated
- [Jose] Update de librerías:
    - [@types/node](https://www.npmjs.com/package/@types/node) 22.8.2

---
## 2024.10.28+1

### Fixed
- [Jose] Corregido error a la hora de detectar cambios en directorios
- [Jose] Corregido reseteo de versión al compilar

---
## 2024.10.25+1

### Fixed
- [Jose] Correcciones varias de estabilidad

---
## 2024.10.24+1

### Fixed
- [Jose] Correcciones varias de estabilidad

---
## 2024.10.23+1

### Added
- [Jose] Se ha migrado las herramientas, la configuración de compilación y la información para desplegar desde el viejo workspace `framework/services-comun`
    - Las clases utilizadas en este workspace no se exportan fuera del mismo, son privadas por lo que no son accesibles desde el resto de workspaces
    - Las herramientas no se almacenan compiladas en el repositorio, si se intentan lanzar antes de compilarlas primero se autocompilan por si mismas
