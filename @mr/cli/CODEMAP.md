# CODEMAP — `@mr/cli`

> Generado: 2026-08-13. Actualizar tras cambios significativos.
> Segmentado por bloques, siguiendo el mismo formato que
> [`@mr/core-network/CODEMAP.md`](../core/network/CODEMAP.md): tabla "Fichero | Símbolos
> exportados", sección "Símbolos" con firmas resumidas, notas "Depende de"/"Usado por" y
> diagrama de dependencias entre bloques al final.
>
> Este fichero complementa a [`README.md`](./README.md) (uso, flags y flujos de trabajo de
> `mrpack` en detalle) sin duplicarlo: aquí solo se documentan ficheros, símbolos
> exportados y relaciones de dependencia entre bloques. Consulta el README para el
> comportamiento funcional de cada comando.

`@mr/cli` es el CLI de ciclo de vida del monorepo `web-www`. Expone **un** binario
(`package.json::bin`):

| Binario | Entry point | Submódulo (documentación detallada) |
|---------|-------------|--------------------------------------|
| `mrpack` | `bin/mrpack.js` → `src/main.ts` | [`src/CODEMAP.md`](./src/CODEMAP.md) |

> **Expuso dos hasta el 2026-09-04.** `mrlang` se mudó a `@mr/core-i18n`, que es donde vive el
> resto de la internacionalización, y lo que las dos CLI compartían salió a
> [`@mr/core-cli`](../core/cli/README.md). Los dos paquetes dependen de él y **ninguno del otro**:
> si aparece aquí un import de `@mr/core-i18n`, o allí uno de `@mr/cli`, es que algo se coló.

---

## 1. Raíz del paquete — `bin/`

**Ficheros:**

| Fichero | Rol |
|---------|-----|
| `bin/mrpack.js` | Entry point ejecutable de `mrpack`. Fija `MRPACK_ROOT` (raíz del monorepo, calculada desde `__dirname`, no `process.cwd()`) y delega en `@mr/core-cli/arranque` |
| `bin/min/*.js` | **Artefactos compilados** (`mrpack-run.js` + `.js.map`); no editar a mano, ver [§7](#7-compilación-del-paquete) |

### Símbolos

#### El arranque, en `@mr/core-cli/arranque`

```js
require("@mr/core-cli/arranque")({modulo: "mrpack", workspace: "@mr/cli", bin: __dirname});
```

Normaliza `MRPACK_ROOT` (fallback a `process.cwd()` si el bin no lo fijó), hace `chdir` a la raíz
del paquete que llama y ejecuta:
- Intenta `require("<bin>/min/<modulo>-run")` directamente.
- Si falla (artefacto ausente o corrupto), compila (`yarn run compile`, vía `spawn`) y
  reintenta una vez.
- Suprime los warnings de proceso `DEP0040` (paquete `punycode` deprecado, arrastrado por
  `dd-trace`/`@google-cloud/storage` vía `node-fetch@2.x`) y `DEP0190` (uso de `shell:true` en
  Windows, necesario porque `yarn` allí es un wrapper `.cmd`).

`bin` es el `__dirname` de quien llama y hay que pasarlo: dentro del módulo compartido,
`__dirname` es el de `@mr/core-cli`.

**Depende de:** ninguno de `src/`. **Usado por:** `bin/mrpack.js` y el `bin/mrlang.js` de
`@mr/core-i18n`.

> Este documento dijo un tiempo que compartir el arranque «obligaría a publicar JS desde un paquete
> de TypeScript», y era falso. `@mr/core-cli` publica `arranque.js` sin problema: su `tsconfig` no
> lleva `allowJs`, así que el fichero no entra en la compilación, y el `exports` apunta a él
> directamente. Lo que sí es cierto es que **tiene que ser JS plano**: lo carga el `bin` antes de
> que exista nada compilado.

---

## 2. `src/` — CLI de ciclo de vida del proyecto

**CODEMAP:** [`src/CODEMAP.md`](./src/CODEMAP.md) (mapa completo: árbol de
directorios, clases, funciones exportadas y grafo de dependencias interno).

Implementa los 7 módulos de `yarn mrpack <modulo>` documentados en el README
(`devel`, `deploy`, `config`, `framework`, `init`, `update`, `autodoc`): compilación/ejecución
de workspaces, gestión de `config.workspaces.json`, instalación/actualización/envío de
frameworks compartidos (GCS), inicialización/normalización del monorepo y generación de
documentación OpenAPI.

**Punto de entrada:** `src/main.ts` → `src.ts::MRPack`.

---

## 3. `mrlang` — ya no vive aquí

Se mudó a **`@mr/core-i18n`** el 2026-09-04: código en `@mr/core/i18n/src/`, bin propio en
`@mr/core/i18n/bin/`, mapa en
[`@mr/core-i18n/src/CODEMAP.md`](../core/i18n/src/CODEMAP.md).

Lo que queda de esa relación en este paquete es **una sola cosa, y no es un import**:
`src/clases/workspace/i18n.ts::I18N` lanza la generación de traducciones como proceso hijo
durante `mrpack devel`, con `spawn("yarn", ["run", "i18n", "run", "generate", …])`. Va por el
script del workspace `i18n` del proyecto, no por el bin, así que `mrpack` no necesita saber en qué
paquete vive `mrlang`.

`src/clases/init.ts` sí escribe la ruta del bin (`@mr/core/i18n/bin/mrlang.js`) en el
`package.json` de los proyectos que inicializa. Es un dato, no una dependencia — pero si `mrlang`
se vuelve a mudar, hay que tocarlo.

Y **`mrpack` mantiene al día su bundle**: `checkMrlang()`
([`clases/framework/cliente.ts`](./src/clases/framework/cliente.ts)) compara
`@mr/core/i18n/bin/hash.md5` con el md5 de su `bin/min/` y lanza su `compile` si no cuadra. Se
llama desde `clases/init.ts::checkCliente` —o sea en `devel`, `update` e `init`— y al terminar una
tanda del gestor de frameworks. Tampoco es una dependencia de código: se invoca `yarn workspace
@mr/core-i18n run compile` como proceso hijo, y si el paquete no está, no hace nada.

---

## 4. `@mr/core-cli` — utilidades compartidas entre las dos CLI

**Ya no están en este paquete.** `src/utiles/fs.ts`, `src/utiles/log.ts`, `src/modulo.ts`,
`src/clases/colors.ts` y `src/utiles/colors.ts` salieron a
[`@mr/core-cli`](../core/cli/README.md) al separar `mrlang`, y se importan por nombre de paquete:

| Antes | Ahora |
|-------|-------|
| `src/utiles/fs` | `@mr/core-cli/fs` |
| `src/utiles/log` | `@mr/core-cli/log` |
| `src/clases/colors` | `@mr/core-cli/colors` |
| `src/utiles/colors` | `@mr/core-cli/colors/base` |
| `src/modulo` | `@mr/core-cli/modulo` |

Los símbolos y el porqué de los forks de `fs`/`log` están en
[`@mr/core-cli/CODEMAP.md`](../core/cli/CODEMAP.md). Aquí basta con dos notas que siguen valiendo:

- `mrpack` los usa en **45 ficheros**, y esbuild los **bundlea** (son un workspace devDep, no una
  `dependency`), así que `bin/min/mrpack-run.js` no lleva ningún `require("@mr/core-cli")`.
- `src/clases/log.ts::Log` es una capa superior propia —con prefijo
  `[hora][tipo][etiqueta]` y anidamiento— que **no** reutiliza `@mr/core-cli/log`.

---

## 5. `manifest/` — Manifest raíz del monorepo (`mrpack.json` de la raíz)

**README:** [`manifest/README.md`](./manifest/README.md) (esquema JSON completo, valores por
defecto y variables de entorno de cada campo).

**Ficheros:**

| Fichero | Símbolos exportados |
|---------|---------------------|
| `index.ts` | `IManifest`, `Manifest` |
| `deploy/index.ts` | `IManifestDeployment`, `ManifestDeployment` |
| `deploy/build.ts` | `IManifestDeploymentBuild`, `ManifestDeploymentBuild` |
| `deploy/run.ts` | `IManifestDeploymentRun`, `ManifestDeploymentRun` |

Define el esquema TypeScript del `mrpack.json` de raíz (bloque `deploy.{build,run}`), leído por
`yarn mrpack deploy`. Es distinto del manifest **por workspace** (`src/clases/manifest/`,
documentado en [`src/CODEMAP.md`](./src/CODEMAP.md)): este bloque solo modela el
manifest de la raíz del monorepo, no el de cada `service`/`job`/`cronjob` individual.

**Depende de:** nada externo (tipos/clases planas). **Usado por:**
`src/clases/manifest/root/` (`ManifestRootLoader`, que carga/normaliza/persiste este
esquema) — la relación entre este directorio y su consumidor real en `src/` está
documentada con más detalle en `src/CODEMAP.md`.

---

## 6. `deployment/` — Infraestructura CI/CD (Cloud Build)

**README:** [`deployment/README.md`](./deployment/README.md) (pipeline `build.yaml` completo,
diagrama de dependencias entre pasos, comandos `bin/` disponibles en el `PATH` del pipeline,
Dockerfiles y plantillas Cloud Run).

No contiene código TypeScript: son scripts Bash (`deployment/std/*.sh`), plantillas YAML
(Cloud Build, Cloud Run) y Dockerfiles, invocados por Cloud Build a través de
`deployment/std/build.yaml`. Los scripts leen los manifests generados por `mrpack`
(`mrpack.json` raíz y por workspace) a través de los comandos `configg`/`configw`
(`deployment/std/bin/`, wrappers de `jq`).

**Depende de (en tiempo de ejecución del pipeline):** los artefactos de `yarn mrpack deploy`
(`output/`, `version.txt`, `hash.txt` de cada workspace) y el esquema de `manifest/` (bloque 5)
para decidir si compilar/desplegar. **No depende de** ni es importado por ningún fichero
TypeScript de `src/`.

---

## 7. Compilación del paquete

El ejecutable de `@mr/cli` (`bin/min/mrpack-run.js`) se genera con
**[esbuild](https://esbuild.github.io/)** a partir de `src/main.ts`. Ver el detalle completo (targets, externals, tamaños, source maps y la
resolución de `tscBin`/fijación de `typescript@^6.x`) en
[`README.md#compilación-del-paquete`](./README.md#compilación-del-paquete); no se duplica aquí.

Scripts relevantes (`package.json`): `compile` (build de producción) y `compile:watch` (watch).
Hubo un `compile:rspack`, fallback al bundler anterior, y se retiró: no lo invocaba nadie.

**`compile:watch` arranca también el watch de `mrlang`** si `@mr/core/i18n/` existe en la raíz del
monorepo, lanzando su propio script como proceso hijo. Devuelve el comportamiento de antes de
separar los dos CLI sin volver a acoplarlos: no se importa su configuración y, si el paquete no
está, no hace nada. `compile` **no** lo hace, porque lo llama el arranque cuando falta el bundle.

---

## Diagrama de dependencias entre bloques

```
bin/mrpack.js ──→ @mr/core-cli/arranque ──→ bin/min/mrpack-run.js (compilado desde src/main.ts)
                                          │
                                          ▼
                                src/main.ts
                                          │
                                          ▼
                                src.ts::MRPack
                                          │
                          (7 módulos: devel/deploy/config/framework/init/update/autodoc)
                                          │
                                          ├──→ @mr/core-cli/{fs,log,colors,colors/base,modulo}
                                          │      (bundleado: es workspace devDep, no dependency)
                                          │
                                          └──→ src/clases/workspace/i18n.ts::I18N
                                                 └─→ spawn("yarn run i18n run generate")
                                                       └─→ el mrlang de @mr/core-i18n, en otro proceso
                                          │
                                          ▼
                          manifest/ (esquema mrpack.json raíz)
                               ▲
                               │ consumido por
                  src/clases/manifest/root/::ManifestRootLoader
                               │
                               ▼
                  deployment/std/build.yaml (Cloud Build; lee manifest/ vía bin/configg,
                                              ejecuta "yarn mrpack deploy"/"yarn mrpack autodoc")
```

**Regla de dependencia:** `@mr/cli` y `@mr/core-i18n` **no se importan entre sí**. Lo que fue una
relación de código —`mrlang` importaba `Modulo` y `Colors` de `mrpack`— es ahora una dependencia
de los dos a `@mr/core-cli`. La única integración que queda entre las dos CLI es el `spawn` de
proceso hijo desde `I18N` durante `mrpack devel`, y va por el script del workspace `i18n`, no por
el bin.

`manifest/` y `deployment/` no dependen de ningún código de `src/`; son consumidos por él (el
primero tipando el `mrpack.json` raíz, el segundo ejecutando los binarios compilados en CI/CD).
