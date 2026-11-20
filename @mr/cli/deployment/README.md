# `@mr/cli/deployment`

Scripts e infraestructura estándar de CI/CD para el monorepo `web-www`.
Todo el contenido reside bajo `deployment/std/` y se invoca desde Cloud Build
a través de `build.yaml`.

---

## Estructura

```
deployment/
└── std/
    ├── build.yaml            Pipeline Cloud Build completo
    ├── guarda.sh             Cancela o espera a los builds anteriores del mismo trigger que sigan en marcha
    ├── aliases.sh            Extiende el PATH para los binarios de bin/; versionNode()/imagenNode(); etiquetaProyecto(); bucketCache()
    ├── instalar.sh           yarn install del monorepo con la versión de Node del repo (paso Instalar Dependencias); sin generar ni _MYSQL, nada
    ├── descargas.sh          Herramientas (jq, yq, kustomize, cloud_sql_proxy) con versión y sha256 fijos, cacheadas en GCS; deja en el log las opciones de CI/CD
    ├── labels.sh             Obtiene clusters GKE y sus namespaces para el entorno activo
    ├── tags.sh               Obtiene tags de imagen Docker existentes por workspace
    ├── autorizar.sh          Añade la IP del worker a los masters authorized networks de GKE
    ├── desautorizar.sh       Elimina la IP del worker de los masters authorized networks de GKE
    ├── clone.sh              Clona el repositorio de kustomize en la rama correcta
    ├── init_kustomize.sh     Inicializa el proyecto kustomize (llama a kustomizar/init.sh)
    ├── cache_get.sh          Descarga la caché de dependencias Yarn desde GCS
    ├── cache_set.sh          Sube la caché de dependencias Yarn a GCS si cambió
    ├── compilar.sh           Compila los workspaces (yarn mrpack deploy); arranca/para cloud_sql_proxy si hay MySQL. Sin generar, solo bin/mantener-version
    ├── contenedor.sh         Construye y sube imágenes Docker con docker buildx (buildkit solo si hay alguna nueva); gestiona los tags `deployed_`/`retained_`
    ├── storage.sh            Sube assets de bundles browser a GCS; calcula versión incremental
    ├── kustomizar.sh         Genera manifiestos Kubernetes/Cloud Run para cada workspace y cluster/zona
    ├── desplegar.sh          Aplica los manifiestos con gke-deploy y ejecuta scripts de Cloud Run (lambda-*.sh)
    ├── auto-doc.sh           Genera documentación automática (yarn mrpack autodoc); requiere MySQL activo
    ├── test.sh               Prueba local del pipeline (cloud-build-local)
    ├── Dockerfile            Imagen genérica para servicios Node.js (runtime node, no Next.js)
    ├── Dockerfile.dockerignore       Exclusiones del contexto al construir con Dockerfile
    ├── Dockerfile-next       Imagen genérica para servicios Next.js
    ├── Dockerfile-next.dockerignore  Exclusiones del contexto al construir con Dockerfile-next
    ├── cloud-run.yml         Plantilla de referencia Cloud Run (Service básico, sin VPC)
    ├── cloud-run-service.yml Plantilla Cloud Run Service (con VPC, load balancer, volumen tmpfs)
    ├── cloud-run-job.yml     Plantilla Cloud Run Job (con VPC, tmpfs, scheduler opcional)
    └── bin/                  Comandos de utilidad añadidos al PATH en cada paso del pipeline
        ├── config            jq sobre un JSON arbitrario: config <ruta.json> <query>
        ├── configc           jq sobre clientes.json:       configc <query>
        ├── confige           jq sobre entornos.json:       confige <query>
        ├── configg           jq sobre mrpack.json raíz:    configg <query>
        ├── configl           jq sobre labels.json:         configl <query>
        ├── configw           jq sobre <ruta>/mrpack.json:  configw <ruta> <query>
        ├── lb                Lista workspaces browser habilitados de un grupo (deploy.runtime == browser)
        ├── lw                Lista workspaces non-browser habilitados de un grupo
        ├── mantener-version  Escribe version.txt y hash.txt con la versión desplegada (sin generar): mantener-version <ruta>
        ├── opcion            Opción del despliegue (trigger o mrpack.json): opcion [--valor] desplegar
        ├── path1             Extrae el primer segmento de una ruta (services/foo → services)
        ├── path2             Extrae el segundo segmento (services/foo → foo)
        └── path3             Extrae el tercer segmento
```

---

## Pipeline `build.yaml`

Pipeline principal de Cloud Build. Cada paso es un contenedor de GCP; los pasos
que no dependen entre sí se ejecutan en paralelo.

### Dependencias entre pasos

Es el `waitFor` de cada paso en `build.yaml`. Va en tabla y no en diagrama porque el diagrama se
quedaba desfasado cada vez que se movía una dependencia.

| Paso | Espera a | Para qué |
|------|----------|----------|
| `Guarda` | — | Ordena los builds del mismo trigger (ver [Builds concurrentes](#builds-concurrentes)) |
| `Descargas` | Guarda | |
| `Descargar Cache Dependencias` | Guarda | Solo necesita el bucket (`bucketCache()`) |
| `Labels` | Descargas | `jq` y `opcion` |
| `Obtener Tags` | Descargas | `jq` |
| `Clonar Repositorios` | Descargas | `jq` y `opcion`; la organización la lee con `etiquetaProyecto()` |
| `Autorizar` | Descargas, Labels | `entornos.json` |
| `Iniciar Kustomize` | Clonar Repositorios | el repo de kustomize |
| `Instalar Dependencias` | Descargar Cache Dependencias, Descargas | `.yarn/cache`; `jq` y `opcion` para saber si se genera |
| `Compilar` | Descargas, Iniciar Kustomize, Instalar Dependencias, Obtener Tags | credenciales de `kustomizar/tmp/`, dependencias, `tags.json` |
| `Subir Cache Dependencias`, `Subir Storage`, `Generar Contenedor` | Compilar | |
| `Kustomizar` | Descargas, Labels, Generar Contenedor | `entornos.json`, `labels.json`, versión de la imagen |
| `Desplegar` | Autorizar, Kustomizar, Subir Storage | |
| `Generar Documentación` | Desplegar | |
| `Desautorizar` | Desplegar, Generar Documentación | |

En un despliegue sin cambios, el camino más largo hasta «Compilar» es la instalación de dependencias
(Guarda → Descargar Cache → Instalar, unos 33 s); «Labels», que tarda ~10 s, solo lo esperan
«Autorizar» y «Kustomizar».

Sin generar (`_GENERAR=false` o `deploy.build.enabled` a `false`) ese camino desaparece: «Instalar
Dependencias» no instala nada (salvo con `_MYSQL`, que necesita `mrpack autodoc`), «Compilar» no
arranca `mrpack` y solo escribe la versión desplegada con `bin/mantener-version`, y «Generar
Contenedor» no hace nada. «Compilar» espera entonces a «Iniciar Kustomize» (~28 s), y lo que queda
detrás es «Kustomizar» y «Desplegar». Antes ese despliegue instalaba todas las dependencias y
arrancaba `mrpack deploy` solo para escribir `version.txt` y `hash.txt`.

### Herramientas

`descargas.sh` instala `jq`, `yq`, `kustomize` y, si hay `_MYSQL_DOC` o `_MYSQL`, `cloud_sql_proxy`, con **versión y
sha256 fijos** en el propio script. Cada una se busca primero en la caché del proyecto,
`gs://<bucket>/herramientas/`, donde `<bucket>` es `_K8S_CACHE` o, si el trigger no la define, la
etiqueta `k8s-cache` del proyecto: el mismo de la caché de Yarn (`bucketCache()` en `aliases.sh`).
Si no está en la caché, la baja de la URL oficial con
reintentos y la sube a la caché para los siguientes builds. Venga de donde venga, comprueba el sha256
y, si no coincide, el build falla. Si no puede subirla a la caché, avisa y sigue.

Antes se bajaban de GitHub en cada build, y `yq` además de `releases/latest`: una caída o un límite de
peticiones de GitHub tumbaba el despliegue, y `yq` podía cambiar de un build a otro.

Para subir una versión hay que cambiar en `descargas.sh` la versión y el sha256, con la suma oficial
que publica cada proyecto. Versiones fijadas el 2026-11-09: `jq` 1.8.2, `yq` v4.54.2 (la v4.54.3 tenía
horas y se fijó la anterior, con el mismo criterio de antigüedad mínima que las dependencias npm),
`kustomize` v5.8.3 y `cloud-sql-proxy` v2.27.0. Antes de cambiar de `jq` 1.7.1 a 1.8.2 se comparó la
salida de las expresiones del pipeline con las dos versiones, sobre ficheros reales, y es idéntica.

### Versión de Node

Una sola versión mayor de Node para local, CI y producción, en el `.node-version` de la raíz del
monorepo. Lo escribe `mrpack init` con la que fija el framework (`NODE_VERSION` en
[`src/clases/init/node.ts`](../src/clases/init/node.ts), hoy `26`), y es lo que usa `fnm` en local.
El pipeline la lee con `versionNode()` de `aliases.sh` y la usa en:

- «Instalar Dependencias» (`instalar.sh`), «Compilar» (`compilar.sh`) y «Generar Documentación»
  (`auto-doc.sh`), con `docker run node:<versión>-alpine`;
- la imagen base de los contenedores (`contenedor.sh` pasa `BASE_IMAGE`), salvo que el workspace fije
  la suya en `deploy.imagen.<entorno>.base`. El `ARG BASE_IMAGE` de los Dockerfile solo vale para
  builds a mano.

Un trigger puede usar otra con la sustitución opcional `_NODE_VERSION` (por ejemplo `24`), para
probarla sin tocar el repo. `lts-latest` —el valor de antes— y un `.node-version` ausente equivalen a
`node:lts-alpine`, como hasta ahora.

La versión entra en el hash de la imagen (`compilar.ts`, vía `MRPACK_NODE_VERSION`), así que
cambiarla regenera todas las imágenes de los Dockerfile estándar, salvo si es `lts`, que deja como
estaban las de los proyectos que aún no la han fijado.

**Por qué fija y no `lts`:** cada octubre `node:lts-alpine` salta de versión mayor sin avisar, y
local, CI y producción cambiaban cada uno por su lado. Así se rompió el pipeline el 2026-10-29, cuando
Node 25 dejó de traer corepack. Subirla es ahora una decisión: cambiar `NODE_VERSION`, enviar el
framework y ejecutar `mrpack init`.

### Builds concurrentes

Cloud Build no serializa los builds de un trigger. Dos pushes seguidos, un webhook de GitHub que
llega tarde o una ejecución a mano mientras corre otra dejan dos builds a la vez, y pasó el
2026-11-09. Los dos publican las mismas etiquetas (`latest`, `<ENTORNO>`…) y despliegan, y si el
más antiguo acaba después, **deja en producción la versión anterior**.

El paso `Guarda` va el primero, y la regla es que **gana el último build creado** —un push, o
una reejecución a mano de un commit viejo para volver atrás—. Para cada build anterior del mismo
trigger que siga en marcha:

- **Si todavía no ha hecho nada** (está en `QUEUED`, o solo ha empezado su propio paso `Guarda`),
  **lo cancela**: ya está superado, y cancelarlo no deja nada a medias. Esto también evita esperar
  a un build atascado en la cola, que es lo que más tiempo puede costar (el 2026-11-09 uno estuvo
  9 minutos en `QUEUED`).
- **Si ya ha pasado de la guarda, lo espera.** Cancelarlo a medias podría dejar la IP de su worker
  en las redes autorizadas del cluster (la quita `Desautorizar`, que no llegaría a correr) o un
  despliegue a medias entre clusters.

Detalles:

- **La espera tiene tope**: `_GUARDA_ESPERA_MAX` (sustitución del trigger, 900 s por defecto), con
  un `timeout` de 1000 s en el paso como respaldo. Al agotarlo, el build **falla en la guarda**, sin
  haber hecho nada, en vez de morir por el `timeout` del build a mitad de despliegue (la espera
  cuenta para ese `timeout`). Si un build anterior se queda colgado, la salida es cancelarlo a mano:
  la guarda del nuevo sigue en el siguiente sondeo (20 s).
- **No salta los builds repetidos** del mismo commit: volver a lanzar un build es la forma de
  redesplegar, por ejemplo tras cambiar una credencial.
- **Si la primera consulta a Cloud Build falla** (permisos, API), avisa con `Guarda: AVISO` y sigue:
  una guarda rota no debe parar todos los despliegues. Ya dentro de la espera, un fallo se reintenta
  cuatro veces y, si persiste, el build falla, porque seguir dejaría dos a la vez. La cuenta del
  build necesita `cloudbuild.builds.get`, `list` y `update` (cancelar): las tienen
  `roles/cloudbuild.builds.builder` (la de la cuenta por defecto), `roles/cloudbuild.serviceAgent` y
  `roles/editor`. Si en un proyecto los primeros builds dicen `Guarda: AVISO`, ahí la guarda no
  está actuando.
- **El orden es el de creación de los builds, no el de los commits.** Si el webhook de un commit
  más antiguo llega tarde, ese build se crea después y es el que queda desplegado. Pasaba igual sin
  la guarda.
- **Agrupa por trigger, no por rama ni por tag**, porque el trigger es lo que fija el destino
  (`_ENTORNO`, pool, clusters). Un trigger con varias ramas (`^(develop|feature/test)$`) ordena los
  builds de las dos. **Ojo con un trigger por tag** sobre este pipeline: si se empujan varios tags
  a la vez, gana el último build creado, que no tiene por qué ser el del tag más nuevo, y los que
  no hayan empezado se cancelan. Si cada tag despliega algo distinto, esto no vale tal cual. Hoy
  ningún trigger por tag usa este pipeline: el único que hay (`tiempo-web-defecto`, en
  `meteored-test`) va por su propio `build.yaml`.
- **Solo coordina builds del mismo trigger.** Dos triggers que desplieguen al mismo entorno (por
  ejemplo `develop` y `feature/test` donde existan los dos) siguen sin coordinarse.
- Un build que espera ocupa un worker del pool.

### Pasos del pipeline

| ID | Imagen GCP       | Script | Descripción |
|----|------------------|--------|-------------|
| `Guarda` | `gcloud`         | `guarda.sh` | De los builds del **mismo trigger** creados antes que este que sigan en marcha, cancela los que aún no han hecho nada y espera, con tope, a los que ya trabajan (ver [Builds concurrentes](#builds-concurrentes)). |
| `Descargas` | `gcloud`         | `descargas.sh` | Instala `jq`, `yq`, `kustomize` y, con `_MYSQL_DOC` o `_MYSQL`, `cloud_sql_proxy`, con versión y sha256 fijos (ver [Herramientas](#herramientas)); deja en el log las opciones `_DESPLEGAR`, `_GENERAR`, etc. (ver [Opciones del despliegue](#opciones-del-despliegue)) |
| `Labels` | `gcloud`         | `labels.sh` | Lista clusters GKE del entorno y obtiene sus namespaces `mrpress`. Genera `entornos.json`, `clientes.json`, `labels.json`. Falla si no hay ningún cluster del entorno y sí workspaces que desplegar: antes el build acababa bien sin desplegar nada. |
| `Obtener Tags` | `gcloud`         | `tags.sh` | Descarga los tags Docker actuales de cada workspace (para decidir si hay que generar imagen). |
| `Autorizar` | `gcloud`         | `autorizar.sh` | Añade la IP pública del worker a `masterAuthorizedNetworks` de cada cluster GKE. Falla tras 20 intentos sin conseguirlo (antes seguía hasta el timeout del build). |
| `Clonar Repositorios` | `gcloud`         | `clone.sh` | Clona el repo de kustomize (rama `main` en producción, `develop` en otros entornos). Requiere el secreto `GITTOKEN`, que va como contraseña (`x-access-token`) para admitir PAT fine-grained. La organización es `_K8S_GITHUB` si el trigger la define, y si no, la etiqueta `k8s-github` de `labels.json`. Si es de otra organización, el token se lee del proyecto de `_K8S_GITHUB_PROYECTO`. |
| `Iniciar Kustomize` | `gcloud`         | `init_kustomize.sh` | Ejecuta `kustomizar/init.sh` para preparar la estructura de overlays. |
| `Descargar Cache Dependencias` | `gcloud`         | `cache_get.sh` | Restaura `.yarn/cache` desde GCS (`gcloud storage cp`) para acelerar `yarn install`. El bucket sale de `bucketCache()` (`aliases.sh`): `_K8S_CACHE` si el trigger la define, y si no, la etiqueta `k8s-cache` del proyecto, leída con `gcloud` (lo mismo en `cache_set.sh`). Como no necesita `labels.json`, espera solo a la guarda y corre en paralelo con «Descargas» y «Labels». |
| `Instalar Dependencias` | `docker`         | `instalar.sh` | `yarn install --immutable --mode=skip-build` del monorepo, sin `enableHardenedMode` (ver [Instalación sin hardened mode](#instalación-sin-hardened-mode)), en un `docker run` con la imagen de Node del repo ([Versión de Node](#versión-de-node)), tras `npm install -g corepack`, `corepack enable` y `corepack install`. Va en `docker run` porque la imagen de un paso de `build.yaml` es fija. Sin generar y sin `_MYSQL` no instala nada: no hay nadie que use las dependencias. Espera también a «Descargas» por el `jq` de `opcion`, sin coste: los dos pasos de los que depende acaban a la vez. `corepack install` prepara la versión de `packageManager`; con el antiguo `corepack prepare yarn@latest` se descargaban dos Yarn por paso cuando `latest` no era la fijada (lo mismo en `compilar.sh` y `auto-doc.sh`). |
| `Compilar` | `docker`         | `compilar.sh` | Ejecuta `yarn mrpack deploy --env=$_ENTORNO` dentro de un contenedor; arranca/para `cloud_sql_proxy` si `_MYSQL` está definido. Omite el `next build` de los workspaces Next cuyo hash no cambia (ver «Sin `next build` cuando el frontend no cambia»). Sin generar no arranca `mrpack`: escribe la versión desplegada de cada workspace de `lw` con `bin/mantener-version` (misma regla que `getVersion()` de `Compilar`), y falla si alguno no tiene versión desplegada. |
| `Subir Cache Dependencias` | `gcloud`         | `cache_set.sh` | Sube `.yarn/cache` a GCS (`gcloud storage cp`/`rm`) solo si el MD5 cambió respecto a la versión cacheada. Ningún fallo de este paso tumba el build: para cuando corre, la imagen ya está subida. |
| `Subir Storage` | `gcloud`         | `storage.sh` | Sube bundles browser (assets) a GCS (`gcloud storage cat`/`cp`) con control de versión incremental (`YYYY.MM.DD-N`). |
| `Generar Contenedor` | `docker`         | `contenedor.sh` | Construye imágenes multiarch con `docker buildx` y las sube a Artifact Registry con tags `latest`, `$VERSION`, `$HASH`, `$ENTORNO` y `deployed_$ENTORNO`. Reutiliza capas entre despliegues vía `buildcache_$ENTORNO` (ver [Caché del contenedor](#caché-del-contenedor)). Solo arranca buildkit si algún workspace tiene `nuevo.txt`: en un despliegue sin cambios eran unos 5 de los 7,6 s del paso. |
| `Kustomizar` | `gcloud`         | `kustomizar.sh` | Genera los manifiestos de despliegue para cada workspace × cluster/zona. Soporta targets `k8s` (GKE) y `lambda` (Cloud Run). Falla si un workspace no tiene `version.txt` (antes desplegaba la versión `0000.00.00`). Avisa (`AVISO:` en el log) si un workspace `k8s` no tiene directorio en el repo de kustomize (ni `_all`, ni `entornos`, ni `clientes`): no se despliega, y antes no lo decía. |
| `Desplegar` | `gke-deploy`     | `desplegar.sh` | Aplica manifiestos GKE con `gke-deploy run` y ejecuta los scripts `lambda-*.sh` de Cloud Run. Si a un cluster no le toca ningún recurso (p. ej. un proyecto solo con lambdas), se salta `gke-deploy` para ese cluster. |
| `Generar Documentación` | `docker`         | `auto-doc.sh` | Ejecuta `yarn mrpack autodoc` contra la instancia `_MYSQL_DOC`; sin ella no hace nada (no usa `_MYSQL`). Es `allowFailure: true` (un fallo se ve en rojo sin marcar fallido el despliegue ya hecho) y lleva `timeout: 600s` propio. |
| `Desautorizar` | `gcloud`         | `desautorizar.sh` | Elimina la IP del worker de `masterAuthorizedNetworks` de todos los clusters. Falla tras 20 intentos sin conseguirlo, porque la IP quedaría autorizada. Si falla un paso anterior no llega a ejecutarse (Cloud Build no tiene pasos que corran siempre). |

### Variables de sustitución

| Variable | Descripción |
|----------|-------------|
| `_ENTORNO` | `produccion` \| `test` \| … Entorno de despliegue |
| `_CLUSTER` | Opcional (vacía por defecto). Valor de la etiqueta `entorno` con el que `labels.sh` filtra los clusters; si no está definida o está vacía, se usa `_ENTORNO`. |
| `_AUTORIZAR` | Si `false`, omite la autorización/desautorización de IPs |
| `_DESPLEGAR` | Si `false`, omite el despliegue (solo compila y genera imagen) |
| `_DESPLEGAR_LATEST` | Sin efecto: el pipeline ya no la lee (ver [Opciones del despliegue](#opciones-del-despliegue)). Se mantiene en `build.yaml` porque los triggers la definen. |
| `_GENERAR` | Si `false`, omite compilación e imagen de contenedor, y también la instalación de dependencias (salvo con `_MYSQL`): se vuelve a desplegar la versión desplegada |
| `_GENERAR_FORZAR` | Si `true`, fuerza la generación aunque el hash no haya cambiado |
| `_K8S_CACHE` | Opcional (vacía por defecto). Bucket de la caché de dependencias y de las herramientas; si está vacía, sale de la etiqueta `k8s-cache` del proyecto (`bucketCache()` en `aliases.sh`). |
| `_K8S_GITHUB` | Opcional (vacía por defecto). Organización de GitHub del repo de kustomize; si está vacía, sale de la etiqueta `k8s-github` del proyecto (`etiquetaProyecto()` en `aliases.sh`). Si no hay ninguna de las dos, «Clonar Repositorios» falla. |
| `_K8S_GITHUB_PROYECTO` | Opcional (vacía por defecto). Proyecto de GCP cuyo secreto `alpred-lectura` tiene el token de esa organización, para cuando el kustomize es de otra organización (un PAT fine-grained solo vale para una). Se define por trigger, junto a `_K8S_GITHUB`, y no tiene etiqueta de proyecto: en un mismo proyecto puede haber triggers que usan su propio kustomize y otros que usan el de otra organización. Si está vacía, se usa `GITTOKEN` del propio proyecto. La cuenta de Cloud Build necesita `roles/secretmanager.secretAccessor` sobre ese secreto. |
| `_MYSQL` | Cadena de conexión Cloud SQL (`proyecto:region:instancia`). Si está vacía, no se arranca el proxy. |
| `_MYSQL_DOC` | Vacía por defecto. Instancia Cloud SQL con la base `doc` del paso «Generar Documentación», y la única forma de activarlo: sin ella no se genera documentación, aunque el trigger defina `_MYSQL` (que no se usa para esto, a propósito). Solo cambia el socket: usuario y contraseña son los de `mysql-services-socket-<env>.json`, que debe existir en esa instancia con permisos sobre `doc`. |
| `_BUILD` | Nombre del worker pool de Cloud Build |
| `COMMIT_SHA` | SHA del commit (inyectado por Cloud Build) |
| `PROJECT_ID` | ID del proyecto GCP (inyectado por Cloud Build) |
| `REPO_FULL_NAME` | `org/repo` del repositorio GitHub (inyectado por Cloud Build) |
| `TRIGGER_NAME` | Nombre del trigger de Cloud Build (usado como clave de caché) |

### Instalación sin hardened mode

El `.yarnrc.yml` tiene `enableHardenedMode: true`, y con él cada `yarn install` vuelve a comprobar
todo el `yarn.lock` contra el registro de npm. Medido en una copia de svc-status con el lockfile sin
cambios: 12,2 s con el modo y 0,7 s sin él. En Cloud Build eran 10 de los ~22 s de «Instalar
Dependencias». `instalar.sh` lo desactiva solo en el pipeline (`YARN_ENABLE_HARDENED_MODE=0`); en
local sigue activo, que es donde se crea el lockfile.

Lo que se sigue comprobando en el pipeline: el checksum de cada paquete contra el `yarn.lock`
(`checksumBehavior: throw`) y, con `--immutable`, que el `yarn.lock` cuadre con los `package.json`
(si no, el build falla). Antes no se comprobaba lo segundo: dentro del `docker run` Yarn no detecta
que está en un CI y no activa `--immutable` por su cuenta. Lo que se deja de comprobar es que un
`yarn.lock` modificado a mano apunte a un paquete distinto con un checksum que encaje, algo que
requiere poder hacer push a la rama que despliega.

### Opciones del despliegue

`_DESPLEGAR`, `_GENERAR` y `_GENERAR_FORZAR` los resuelve el comando [`opcion`](std/bin/opcion) cada
vez que un paso los necesita: `if opcion desplegar; then`, o `opcion --valor generar-forzar` para
obtener `true`/`false`. Manda la variable del trigger si vale `true`/`1` o `false`/`0`; si no, el
`mrpack.json` raíz (`deploy.run.enabled`, `deploy.build.enabled`, `deploy.build.force`). Las dos
primeras son «sí» salvo que valgan `false`, y `_GENERAR_FORZAR` es «no» salvo que valga `true`.

Antes `descargas.sh` las resolvía una vez y las dejaba en ficheros (`DESPLEGAR.txt`, `GENERAR.txt`,
`DESPLEGAR_LATEST.txt` y `.env`). Un fichero que faltaba contaba como «no» sin
avisar. Ahora `descargas.sh` solo las resuelve para dejarlas en el log («Opción desplegar: true»…) y
para que el build falle ahí si alguna no se puede resolver. Dentro de un `if` un error de `opcion`
cuenta como «no», y ese primer paso es lo que lo evita.

**`mrpack deploy` también las lee**, de sus variables de entorno (`applyENV()` del manifest raíz), y
corre dentro de un `docker run` que no hereda las del paso. Por eso `compilar.sh` le pasa
`_GENERAR` y `_GENERAR_FORZAR` ya resueltas (`_GENERAR` siempre a `true`: sin generar, `compilar.sh` no
arranca `mrpack`). Antes le llegaban por el `.env` de la raíz, que `mrpack`
carga al arrancar con `dotenv/config` ([`root/index.ts`](../src/clases/manifest/root/index.ts)) y
que ya no se escribe. Ojo: si alguien deja un `.env` en la raíz del repo, `mrpack` lo sigue cargando,
aunque las variables que se le pasan con `-e` mandan sobre él (`dotenv` no sobrescribe las que ya
existen).

**`_DESPLEGAR_LATEST` ya no la usa el pipeline.** Solo servía en un build que despliega sin generar
imagen, para elegir entre volver a desplegar la última imagen construida (etiqueta `<entorno>`) o la
desplegada (`deployed_<entorno>`). Como cada imagen nueva recibe las dos etiquetas a la vez, las dos
apuntan siempre a la misma salvo que un build se lance con `_DESPLEGAR=false`. Además, la única rama
que la leía (`contenedor.sh`, sin imagen nueva) etiquetaba `deployed-<entorno>`, con guion, y
`tags.sh` busca `deployed_<entorno>`. `build.yaml` la sigue pasando a los pasos, porque casi todos los
triggers la definen, pero nadie la lee. `mrpack` la recibía por el `.env` (con `true`, y comparaba el
hash con `tags.json`). Ahora no le llega y usa `deploy.run.latest` del `mrpack.json` (`false` en todos
los monorepos): compara con `deployed.json`, que es la misma imagen, y sin imagen nueva mantiene la
versión desplegada.

---

## Herramientas `bin/`

Todos los scripts del pipeline hacen `source aliases.sh` al inicio, lo que añade
`$ROOT/@mr/cli/deployment/std/bin` al `PATH`. Así se pueden usar directamente por nombre.

### Comandos de configuración

| Comando | Fichero fuente | Descripción |
|---------|---------------|-------------|
| `config <json> <query>` | cualquier JSON | `jq -r <query> <json>` |
| `configg <query>` | `mrpack.json` raíz | Lee el manifiesto raíz del monorepo |
| `configw <ruta> <query>` | `<ruta>/mrpack.json` | Lee el manifiesto de un workspace |
| `confige <query>` | `entornos.json` | Lee la lista de clusters del entorno (generada por `labels.sh`) |
| `configc <query>` | `clientes.json` | Lee la lista de clusters de clientes (generada por `labels.sh`) |
| `configl <query>` | `labels.json` | Lee las labels del proyecto GCP (generadas por `labels.sh`) |
| `opcion [--valor] <nombre>` | trigger y `mrpack.json` raíz | Resuelve `desplegar`, `generar` o `generar-forzar` (ver [Opciones del despliegue](#opciones-del-despliegue)) |

### Comandos de listado de workspaces

| Comando | Descripción |
|---------|-------------|
| `lw <grupo>` | Lista las rutas de workspaces habilitados con runtime **no** browser ni cfworker en `<grupo>/` (e.g. `lw services`) |
| `lb <grupo>` | Lista las rutas de workspaces habilitados con runtime **browser** en `<grupo>/` |

Ambos comprueban `mrpack.json` del workspace: `enabled == true` y `deploy.enabled == true`.

### Comandos de rutas

| Comando | Input | Output |
|---------|-------|--------|
| `path1 <ruta>` | `services/foo` | `services` |
| `path2 <ruta>` | `services/foo` | `foo` |
| `path3 <ruta>` | `a/b/c` | `c` |

---

## Dockerfiles

### `Dockerfile` — Servicios Node.js genéricos

Build multi-stage, con cuatro stages:

| stage | plataforma | qué hace |
|---|---|---|
| `manifiesto` | la del builder | el `package.json` del workspace sin `version` (ver [Caché del contenedor](#caché-del-contenedor)) |
| `deps` | la del builder | `yarn workspaces focus --production` para la arquitectura destino, sin scripts de build |
| `build` | la destino | el mismo `focus`, que solo ejecuta los scripts de build (compila `bufferutil`) |
| `app` | la destino | copia `.yarn`, `.pnp.*` y los artefactos (`output/`, `assets/`, `app.js`) |

El entrypoint es `run.sh`, que ejecuta `exec node <yarnPath> workspace <ws> node --no-warnings app.js` (el `yarnPath` del
`.yarnrc.yml`, leído al construir la imagen; sin él, `exec yarn …`). El PID 1 tiene que ser Yarn, que es quien reenvía
SIGTERM a Node: sin `exec` lo era `sh`, que la ignora (el kernel no aplica al PID 1 la acción por defecto de una señal sin
handler), y con `exec yarn` lo es el shim de corepack, que con `yarnPath` lanza el Yarn del repo como proceso hijo y
tampoco la reenvía. En los dos casos el pod moría por SIGKILL al acabar la gracia (medido en svc-status el 2026-11-12).
Lo comprueba `spec/init/dockerfile.spec.ts`, que ejecuta los `RUN` que escriben `run.sh`; `Dockerfile-next` igual. Con Next también
funciona: en un `rollout restart` de status-frontend, con un bucle de peticiones cada 50 ms, salieron 1811 de 1811 con 200
(medido el 2026-11-13). Los
`Dockerfile` propios que todavía arrancan con `RUN echo "yarn workspace ${WS} …" >> run.sh` los deja igual `mrpack init`
(`src/clases/init/dockerfile.ts → parchearArranque()`), y avisa de los que arrancan de otra forma. Por qué
`deps` y `build` están separadas: [Arquitecturas](#arquitecturas-y-cómo-se-evita-emular-el-install).

**Build args:** `BASE_IMAGE`, `RUTA`, `WS`, `DD_GIT_REPOSITORY_URL`, `DD_GIT_COMMIT_SHA`.
Los dos de Datadog los consume **solo** la stage `app`, a propósito: ver
[Caché del contenedor](#caché-del-contenedor).
**Puerto expuesto:** `8080`.

### `Dockerfile-next` — Servicios Next.js

Igual al anterior pero copia `.next/` y `public/` en lugar de `assets/` y `output/`,
incluye `next.config.js` y `next.config.deps.js`, y el entrypoint ejecuta
`yarn workspace <ws> run next start -p 8080`.

### Yarn ya preparado en la imagen

Las stages que usan Yarn instalan corepack (`npm install -g corepack && corepack enable`; desde
Node 25 la imagen oficial no lo trae) y preparan Yarn con `corepack install`, que toma la
versión exacta del `packageManager` del `package.json` raíz.

Importa en la stage `app`, porque el entrypoint arranca con `yarn`: corepack ejecuta
siempre la versión de `packageManager` y, si no la tiene en su caché, **la descarga en
cada arranque de pod**, aunque `yarnPath` apunte a `.yarn/releases`, que ya está en la
imagen. Por eso:

- `corepack install` y no `corepack prepare yarn@latest`. `latest` solo coincide con la
  versión fijada por casualidad, y esa capa se reutiliza desde la caché del registro: se
  queda con el `latest` del día en que se construyó.
- Va detrás del `COPY ./package.json`, para que se rehaga cuando cambie `packageManager`.
- `COREPACK_HOME=/usr/local/share/corepack`: la caché queda en una ruta fija y no bajo
  `$HOME`, así que vale aunque el pod arranque con otro usuario u otro `HOME`.
- `COREPACK_ENABLE_NETWORK=0 yarn --version` justo después: si corepack necesitara la red
  para arrancar Yarn, falla el build y no el arranque del pod.

Los `Dockerfile` propios de los workspaces los deja igual `mrpack init`
(`src/clases/init/dockerfile.ts → parchearCorepack()`), con un aviso por cada etapa que no
sepa parchear. Eso incluye el compilador en la etapa que instala las dependencias, pero **no**
la separación en `manifiesto`/`deps`/`build` de los Dockerfile estándar: reorganizar las etapas
de un Dockerfile ajeno es demasiado frágil para un parche automático. Quien tenga uno propio y
quiera esas mejoras —sobre todo si construye arm64— tiene que copiar la estructura a mano.

---

## Caché del contenedor

Las stages antes de `app` de los dos Dockerfiles genéricos existen para una sola cosa:
resolver las dependencias de producción del workspace. Es también la parte cara del paso
`Generar Contenedor`, así que están montadas enteras alrededor de poder **saltárselas**.

Tres piezas, que funcionan juntas:

**1. El install no ve el código.** Copia el `package.json` del workspace y nada
más de él. Puede hacerlo porque todas las dependencias entre workspaces
(`services-comun`, `@mr/core-*`, `i18n`…) viven en `devDependencies` y
`focus --production` las ignora. Así su clave de caché depende solo de `yarn.lock` y
de ese `package.json`, no de lo que se haya tocado en el commit.

**2. Y ese `package.json` entra sin `version`.** El paso `Compilar` le escribe una versión
nueva (`2026.11.09-002`…) cada vez que se va a generar la imagen
([`compilar.ts`](../src/clases/workspace/compilar.ts)), así que copiado tal cual cambiaba en
cada build y **la capa del install no se reutilizaba nunca**: en los logs de svc-ads y
svc-vienty de noviembre de 2026 el `focus` arm64 se ejecutaba en todos los builds, entre 68 y
228 s, aunque no cambiaran las dependencias. La stage `manifiesto` copia el fichero y le quita
`version` (nativa, sin emulación), y las de abajo copian ese. La imagen final sigue teniendo la
versión real: la stage `app` copia el `package.json` completo. Medido en local con una versión
distinta entre dos builds: de 59 s a 1 s, con el install `CACHED`.

Por el mismo motivo esas stages **no declaran** `DD_GIT_REPOSITORY_URL` ni
`DD_GIT_COMMIT_SHA`: el SHA cambia en cada commit y un `ARG` declarado ahí mete su
valor en la clave de caché de todo lo que venga detrás. Los declara la stage `app`,
que es la única que los usa, y **al final**, después de su último `RUN`: un `ARG` declarado
entra como variable de entorno en todos los `RUN` posteriores aunque no lo usen, así que al
principio de la stage hacía que su `apk add`, el corepack y el `corepack install` se
ejecutaran en cada build (en arm64, emulados, unos 30 s). Comprobado en local: dos builds con
distinto `DD_GIT_COMMIT_SHA` reutilizan todos los `RUN` de `app`, y la imagen lleva el SHA nuevo.

**3. La caché vive en el registro.** `contenedor.sh` crea el builder con
`docker buildx create --driver docker-container` en cada ejecución con alguna imagen nueva, y ese builder
nace vacío: sin `--cache-from`/`--cache-to` no hay nada que reutilizar de un
despliegue al siguiente. La caché se guarda en la misma imagen, bajo el tag
`buildcache_<ENTORNO>` — uno por entorno, porque la imagen base puede diferir.

Dos detalles que no son cosméticos:

- `mode=max`. La capa que interesa está en una stage intermedia que no llega a la
  imagen final, y el modo por defecto solo guarda las capas publicadas.
- `image-manifest=true,oci-mediatypes=true`. Artifact Registry rechaza el formato de
  caché por defecto de buildkit.
- `compression=zstd`. Con `mode=max` buildkit comprime al exportar todas las capas
  intermedias, que no se suben con la imagen. En gzip, el frontend tardaba 29 de los
  35 s de la exportación solo en ese paso («preparing build cache for export»). Solo
  cambia la caché. La imagen que se despliega sigue en gzip, así que los nodos no
  notan nada.

`ignore-error=true` hace que un fallo al **escribir** la caché no tumbe el despliegue.

### Lo que `.yarn/cache` **no** es, y por qué no se puede montar

Parece que aquí falta una tercera pieza: el install baja de npm todo el árbol de
producción, y el pipeline ya tiene la caché de Yarn del monorepo restaurada desde GCS
por `cache_get.sh`. Montarla dentro del contenedor ahorraría esa descarga.

Se probó, y **rompe la imagen**:

```
Error: Required package missing from disk.
Missing package: source-map-support@npm:0.5.21
Expected package location: /usr/src/app/.yarn/cache/source-map-support-npm-0.5.21-…zip/node_modules/…
```

Con `enableGlobalCache: false` —que es lo que hay en el `.yarnrc.yml` del monorepo—
`.yarn/cache` **no es una caché de descarga: es el almacén de paquetes en tiempo de
ejecución.** PnP resuelve cada paquete leyendo directamente su `.zip` de ahí dentro, y
lo que lo mete en la imagen es el `COPY --from=build /usr/src/app/.yarn` de la stage
`app`. Un `--mount=type=bind` deja los zips en el montaje, que se descarta al acabar la
instrucción: la imagen sale con un `.pnp.cjs` apuntando a ficheros que no existen y el
contenedor muere al arrancar.

No hay atajo evidente: copiar la caché del monorepo en lugar de montarla mete ~300 MB
de dependencias de desarrollo en la imagen, y el subconjunto de producción no se sabe
hasta que el install ha terminado.

Así que el install se baja lo suyo de npm, y de saltarse esa descarga se encarga la
pieza 2: mientras no cambien `yarn.lock` ni el `package.json` del workspace, la capa
entera —zips incluidos— viene de la caché del registro y el install no llega a
ejecutarse. La descarga solo ocurre cuando cambian las dependencias, que es cuando hay
algo nuevo que bajar de todas formas.

### Modo endurecido de Yarn

La stage `build` fija `YARN_ENABLE_HARDENED_MODE=0`. El modo endurecido es
`--check-resolutions --refresh-lockfile`: revalida contra el registro que cada
resolución del lockfile corresponde a su rango.

Es una comprobación de cadena de suministro que el pipeline **ya ha hecho**, en el
paso `Instalar Dependencias`, sobre este mismo lockfile y con el `.yarnrc.yml` del
repositorio. Repetirla dentro de cada contenedor, una vez por servicio, no descubre
nada que no se supiera y cuesta una ronda de red por cada rango.

Se desactiva por variable de entorno y no tocando el `.yarnrc.yml`, para que en el
repositorio —donde sí sirve— siga activa.

### Exclusiones del contexto

`Dockerfile.dockerignore` y `Dockerfile-next.dockerignore`, uno al lado de cada
Dockerfile. BuildKit busca `<nombre del Dockerfile>.dockerignore` antes que el
`.dockerignore` de la raíz del contexto, y eso es justo lo que hace falta aquí: el
fichero viaja con el Dockerfile dentro del framework y llega a todos los proyectos a
la vez que él, sin depender de que nadie regenere ficheros en la raíz de cada
monorepo. El precio es que solo cubre a ese Dockerfile — un workspace con `Dockerfile`
propio necesita su propio `Dockerfile.dockerignore` al lado.

Sin ellos el contexto que se manda al builder es el repositorio entero. Lo que más
pesaba y nunca se copió:

| Ruta | Por qué sobra |
|------|---------------|
| `.yarn/unplugged` | La regenera `yarn workspaces focus` dentro del contenedor |
| `.yarn/cache` | La del monorepo; la stage `build` se descarga su propio subconjunto |
| `.git` | No la copia ningún `COPY` |
| `**/.next/cache` | Caché de compilación de `next build`; `next start` no la lee |
| `.pnp.*` | El de la imagen sale de la stage `build`, no del contexto |

`**/.next/cache` además **adelgaza la imagen**: se estaba subiendo al registro y
descargando en cada arranque de pod sin que nadie la usara.

Cuidado al añadir entradas: entre las dos stages se copian `output/`, `assets/`,
`.next/`, `public/`, `app.js`, `mrpack.json`, los `package.json`, `yarn.lock`,
`.yarnrc.yml` y `.yarn/{plugins,releases}`. Nada de eso puede entrar.

Si alguna versión de BuildKit no soportara el fichero por Dockerfile, lo ignora en
silencio y el contexto se manda entero: se pierde la mejora, no se rompe el build. Se
comprueba en el log del paso, en la línea `transferring context`.

### Arquitecturas, y cómo se evita emular el install

`deploy.arch` de cada workspace decide las plataformas que construye `buildx`. **El pool de
Cloud Build no tiene worker arm64**: su cabecera lo dice en cada build,

```
Platforms: linux/amd64, linux/amd64/v2, linux/amd64/v3, linux/386
```

así que el arm64 se construye **emulado con QEMU**. Medido en un build de `status-frontend`
con 394 paquetes de producción (216 MiB):

| plataforma | `yarn workspaces focus` | del cual, Fetch step |
|------------|------------------------|----------------------|
| `linux/amd64` | 18,4 s | 14,3 s |
| `linux/arm64` | **232,9 s** | **3m 20s** |

Trece veces más, y era casi todo el paso. Descomprimir y verificar los zips es trabajo de CPU, y
emulado se paga entero.

**Por eso el install va en dos stages.** Lo único del `focus` que depende de la arquitectura son los
paquetes con binarios por plataforma (`sharp`, `@datadog/*`, `valkey-glide`…), que se eligen al
resolver, y los scripts de build. Así que:

- `deps` corre en la plataforma del builder (`FROM --platform=$BUILDPLATFORM`) y hace la resolución,
  la descarga y el enlazado **para la arquitectura destino**: `supportedArchitectures` con la CPU de
  `TARGETARCH` (en nombres de Node: `amd64` → `x64`) y `libc` `musl`, y sin scripts
  (`YARN_ENABLE_SCRIPTS=false`; `focus` no admite `--mode=skip-build`). `supportedArchitectures` se
  pone en el `.yarnrc.yml` solo para ese comando y se restaura, porque ese fichero llega a la imagen.
- `build` corre en la destino, copia el resultado y repite el `focus`. Lo encuentra todo descargado y
  enlazado, así que solo ejecuta los scripts de build. (`yarn rebuild` no sirve: resuelve el monorepo
  entero, y aquí solo está el workspace.)

Medido en local (2026-11-09, `status-backend`, Mac ARM: amd64 es la emulada, el papel que tiene arm64
en Cloud Build), con el build en frío, que es lo que pasa cuando cambian las dependencias:

| | total | install emulado |
|---|---|---|
| todo el install emulado | 80 s | 53 s |
| `deps` nativa + `build` emulada | **34 s** | 10 s (más 9 s nativos) |

La imagen sale igual: los mismos zips en `.yarn/cache`, las 13 dependencias de producción cargan y
`bufferutil` es nativo. Solo se ha probado en esa dirección (builder arm64 → destino amd64); la de
Cloud Build es la contraria.

**`bufferutil` en arm64 necesita compilador, y por eso la stage `build` lleva `build-base` y
`python3`.** Sus binarios precompilados para Linux están hechos contra glibc, y Alpine usa musl:

| arquitectura | binario precompilado pide | en Alpine |
|---|---|---|
| `linux/amd64` | `libc.so.6` | **carga**: el cargador de musl trata `libc.so.6` como un alias de sí mismo |
| `linux/arm64` (desde la 4.2.0; antes no había) | `libc.so.6` y `ld-linux-aarch64.so.1` | **no carga**: el cargador de glibc no existe |

En arm64 la instalación intenta entonces compilarlo, y sin compilador falla —`couldn't be built
successfully (exit code 1)`—. Es una `optionalDependency`, así que el build sigue, y `bufferutil` se
queda con su `fallback.js`: la imagen arm64 sale con la versión en JavaScript y nadie se entera. Con
`build-base` y `python3` compila contra musl (`build/Release/bufferutil.node`) y carga el nativo. En
amd64 no llega a compilar: usa el precompilado. Va solo en la stage `build`, que se descarta, así que
la imagen final no crece; lo que cuesta es instalarlo y, en arm64, compilar emulado, y las dos cosas
las salta la caché de capas mientras no cambien las dependencias.

Medido el 2026-11-09 construyendo `status-backend` en local con las dos arquitecturas. **Ojo al
comprobarlo:** `require("bufferutil")` devuelve `mask` y `unmask` también cuando ha caído al
fallback, así que eso no prueba nada. Lo que lo prueba es qué `.node` aparece en `/proc/self/maps`, o
que `mask` no sea la de `bufferutil/fallback`.

Conclusión práctica: **no pidas arm64 si no hay nodos arm64**: aunque el install ya no se emule, la
stage `build` y la `app` sí, y sale más caro que construir solo amd64. Si hacen falta las dos de verdad
y aun así pesa, el siguiente paso es un worker arm64 real en el builder (`docker buildx create
--append`), que quita la emulación del todo.

Ojo, que `deploy.arch` tiene un segundo efecto que no está en este paso: `kustomizar.sh` se lo pasa
a `kustomizar/build.sh` (repo de kustomize), y **si la lista contiene `linux/arm64`** los
`Deployment`/`CronJob` reciben una tolerancia al taint `kubernetes.io/arch=arm64:NoSchedule` y una
`nodeAffinity` *preferida* hacia arm64. Las dos son inertes en un cluster sin nodos arm64 —la
afinidad es blanda—, pero conviene saber que el campo mueve las dos cosas a la vez: se quita y se
pone de una pieza.

---

## Caché de compilación de webpack, y por qué no se quedó

Se probó y se quitó. Queda escrito para que nadie lo vuelva a intentar sin saber lo que ya se midió.

El paso `Compilar` es, al 87%, un solo `next build`: medido en `svc-status`, los tres servicios que
van por esbuild acaban en seis segundos entre los tres y el frontend Next tarda 91. Se invoca con
`--webpack` desde [`compilar.ts`](../src/clases/workspace/compilar.ts) —Turbopack no vale porque no
es compatible con PnP—, y webpack 5 guarda una caché de compilación en `.next/cache` que el pipeline
no conservaba entre builds.

**En local la caché vale mucho. En Cloud Build no vale casi nada.**

| | Local (Mac ARM) | Cloud Build (n2d-standard-16) |
|---|---|---|
| Build en frío | 42 sg | 91 sg |
| Build con caché caliente | 24 sg | 87 sg |
| Ganancia | **43%** | **~4 sg** |

Las dos columnas son el mismo escenario —fuentes idénticas, acierto total de caché—, así que la
diferencia no es la tasa de acierto. La pista está en la primera fila: CI tarda **más** del doble
que un portátil teniendo cuatro veces más cores. Lo que domina ahí no son las transformaciones de
módulos, que es lo único que la caché se ahorra; casi seguro es E/S —el disco de red del worker, más
el bind mount del `docker run` de `compilar.sh`—, y eso se paga igual con caché que sin ella.

Cuatro segundos no pagan ~890 MB de trasiego contra GCS en cada build, un paso más en el pipeline y
un script que mantener.

Dos cosas más que se midieron por el camino, por si sirven para otra idea:

- **La caché ocupa ~890 MB útiles en solo trece ficheros `.pack`.** Bajarla costaba 9 sg, y en un
  paso propio —paralelo al install— salía gratis. El problema nunca fue el transporte.
- **Webpack reescribe todos los `.pack` en cada build aunque no cambie una línea.** Entre dos
  compilaciones de las mismas fuentes salieron los siete ficheros con checksum distinto, y encima
  aparecieron packs nuevos (client de 2 a 4, server de 3 a 5). Así que un `rsync` no ahorra nada: si
  se sube, se sube entero.

Si algún día se retoma, el sitio donde mirar no es la caché sino la E/S del paso: `compilar.sh`
monta `/workspace` dentro de un contenedor y todo el árbol del build pasa por ahí.

---

## Sin `next build` cuando el frontend no cambia

Lo que sí funcionó es **no compilar**. Si el hash de un workspace Next no cambia, su `next build` no
sirve para nada: no se escribe `nuevo.txt` y «Generar Contenedor» no construye imagen. Y el hash se
puede saber antes de compilar, porque lo único que sale del build y entra en él es `.next/BUILD_ID`.
Ese id no es aleatorio: lo calcula el `generateBuildId` del `next.config` del proyecto, a partir del
contenido de sus fuentes (`buildDirs` en `framework/services-comun/next.config.js`).

`packNextJS()` ([`compilar.ts`](../src/clases/workspace/compilar.ts)):

1. Calcula el `BUILD_ID` sin compilar: un `node -e` en el workspace carga la configuración con el
   cargador del propio Next (`next/dist/server/config`, fase de build) y llama a `generateBuildId()`
   ([`build-id.ts`](../src/clases/workspace/build-id.ts)). En Cloud Build tarda unos 4 s.
2. Con él calcula el hash entero, como si el fichero ya existiera (`md5Fichero()`, que da lo mismo que
   `md5Dir()`).
3. Si coincide con el de la imagen desplegada (`tags.json`), escribe la versión de siempre y **no
   lanza `next build`** (en el log, «Sin cambios»).
4. Si no, compila como siempre, y al acabar comprueba que el `BUILD_ID` real es el previsto. Si no lo
   es, avisa: ese proyecto se compilará siempre, que es lo que pasaba antes. Nunca puede omitirse un
   build que hacía falta, porque para omitirlo el hash previsto tiene que coincidir con el de una
   imagen ya construida.

Se compila siempre si el despliegue va forzado (`_GENERAR_FORZAR`), si no hay versión desplegada, o si
el proyecto no tiene `generateBuildId` (Next pone entonces un id aleatorio en cada build).

El formato del hash no cambia: un proyecto que reciba esto no regenera ninguna imagen. Medido en
`svc-status`, en una copia del repo con `mrpack deploy --env=produccion`: el mismo hash que antes
(`9c3cf90e`), 32 s → 6 s el paso entero cuando el frontend no cambia, y compila en cuanto se toca una
fuente. En Cloud Build el `next build` son unos 87 s de los ~100 del paso.

**Una condición que hay que respetar:** el `BUILD_ID` depende también de ficheros que `next build`
reescribe. `next-env.d.ts` está en los `buildDirs` de `status-frontend`, y Next lo cambia al compilar
(las rutas `.next/dev/types` pasan a `.next/types`). El id se calcula antes de reescribirlo, así que en
el pipeline, que parte siempre de un checkout limpio, cuadra. En local, después de un `next build`, el
id previsto cambia hasta que se restaure el fichero. Lo mismo con `package.json`: `mrpack deploy`
escribe en él la versión, y también está en los `buildDirs`.

---

## Imagen en el despliegue GKE

Con los overlays `entornos/` y `clientes/`, `updateImagen()` (en `kustomizar.sh`) reescribe
la imagen que referencian los manifiestos del repo de kustomize
(`europe-west1-docker.pkg.dev/<proyecto>/<kustomize.dir>/<workspace>`) con
`kustomize edit set image <nombre>=<imagen>:<versión>`. Así apunta a la imagen que ha
subido `contenedor.sh`: `deploy.imagen.<entorno>.registro`, `.paquete` y `.nombre`, con
los mismos valores por defecto (`europe-west1-docker.pkg.dev`, `services` y el nombre del
workspace). Con el overlay `_all/`, la imagen la monta `kustomizar/build.sh`, que vive en
el repo de kustomize.

## Programación del heartbeat de los CronJobs

Las variables `CRON_*` del heartbeat (nombre, `schedule`, `timeZone`, `concurrencyPolicy`, `startingDeadlineSeconds` y
`activeDeadlineSeconds`) se declaran vacías en `_componentes/{cronjob,job}` del repo de kustomize y las rellena su
`scripts/cron-env.yq` a partir del CronJob ya construido. Con el overlay `_all/` lo hace `kustomizar/build.sh`
(`add_cron_env`); con `entornos/` y `clientes/`, `parseWorkspaceEjecutar()` de `kustomizar.sh`, **solo si el repo trae
`scripts/cron-env.yq` y la salida tiene algún `kind: CronJob`**. Si no, la salida es la de siempre y no pasa por yq (que
reformatea la indentación de todo el documento). Sin este paso, un CronJob construido por `entornos/` sale con la programación
vacía: sigue informando del resultado de cada ejecución, pero no se detectan las saltadas.

## Plantillas Cloud Run

Usadas por `kustomizar.sh` cuando el workspace tiene `deploy.target = "lambda"`:

| Fichero | Tipo | Descripción |
|---------|------|-------------|
| `cloud-run-service.yml` | `Service` (Knative) | Servicio HTTP persistente con VPC, load balancer interno + público, volumen tmpfs en `/files/tmp/` |
| `cloud-run-job.yml` | `Job` (Cloud Run v1) | Job puntual o cronjob con VPC y tmpfs; el scheduler se crea/actualiza/elimina según `deploy.schedule` y `deploy.type` |
| `cloud-run.yml` | `Service` (Knative) | Plantilla de referencia simplificada sin VPC (solo consulta) |

Los placeholders `${REGISTRO}`, `${PAQUETE}`, `${NOMBRE}`, `${PROJECT_ID}`,
`${KUSTOMIZER}`, `${IMAGEN}`, `${VERSION}`, `${ENTORNO}` y `${ZONA}` son sustituidos por
`kustomizar.sh` con `sed` antes de aplicar la plantilla.

La imagen del contenedor (`${REGISTRO}/${PROJECT_ID}/${PAQUETE}/${NOMBRE}`) sale de
`deploy.imagen.<entorno>.registro`, `.paquete` y `.nombre`, con los mismos valores por
defecto que usa `contenedor.sh` al subirla (`europe-west1-docker.pkg.dev`, `services` y
el nombre del workspace): `imagenSubida()` es la misma para Cloud Run y para GKE. El
nombre del servicio o job (`${KUSTOMIZER}-${IMAGEN}`) sigue saliendo de
`deploy.kustomize[].dir` y `.name`.

Tras aplicar la plantilla, `parseWorkspaceLambdaZona()` añade las variables de
`deploy.env` (si existen) al `env` del contenedor mediante `yq`, sumándose a las
ya fijas de la plantilla (`DATADOG`, `ENTORNO`, `ZONA`, `CLOUD_RUN_REGION`,
`SIDECAR`) sin pisarlas.

### Autenticación

Con `deploy.lambda.authentication: false`, `parseWorkspaceLambdaZona()` añade
`run.googleapis.com/invoker-iam-disabled: "true"` al servicio: es el «Allow public
access» de la consola, y no exige autenticación para invocarlo. Sin el campo, o con
`true`, el servicio la exige. Solo aplica a servicios, no a jobs. Es independiente del
ingress: detrás de un load balancer basta el de por defecto
(`internal-and-cloud-load-balancing`), y `"all"` solo hace falta para llamar
directamente a la URL `*.run.app`. La cuenta que despliega necesita
`run.services.setIamPolicy`.

### Labels

Las labels `dpto` y `producto` se ponen en el servicio o job y en su plantilla, para
que las tengan también las revisiones o ejecuciones. Cada una sale de
`deploy.lambda.labels` y, si no está ahí, de la label homónima del proyecto de GCP
(`labels.json`). Si no está en ninguno de los dos, no se pone. Un valor que no cumpla
el formato de Cloud Run (minúsculas, números, `_` y `-`, hasta 63 caracteres) hace
fallar `kustomizar.sh`.

Tienen que ir en el YAML: las que se pongan a mano en la consola o con
`gcloud … --update-labels` las borra el siguiente `replace`.

### Nombre del servicio o job

Cada elemento de `deploy.kustomize` es un despliegue, con nombre `<dir>-<name>`: el del
servicio o job de Cloud Run y, con zona, el del trigger de Cloud Scheduler. Así un mismo
workspace puede desplegar varias lambdas con distinto nombre y la misma imagen.

`dir` y `name` admiten `${ENTORNO}` y `${ZONA}`, que `parseWorkspaceLambdaZona()` resuelve
en cada zona de destino (por ejemplo `"name": "logs-${ZONA}"`). Cualquier otro `${...}`
hace fallar `kustomizar.sh` en vez de desplegar un nombre a medias. Cambiar el nombre de
una lambda ya desplegada crea un servicio nuevo y deja el anterior —y su trigger— sin
borrar.

### Región y zona de destino

Por defecto un workspace `lambda` se despliega **una vez por región** con cluster en
el entorno: `kustomizar.sh` recorre `entornos.json` y llama a
`parseWorkspaceLambdaZona()` con la `.zone` del cluster como región y su
`.resourceLabels.zona` como zona. Si una región tiene varios clusters, se despliega
una sola vez, con la zona del primero del array. Un cluster sin la label `zona` hace
fallar el despliegue.

Con `deploy.alone = true` en el `mrpack.json` del workspace se despliega **una sola
vez**: en la región de Bélgica (`europe-west1`) si el entorno tiene un cluster allí,
y si no, en el primero del array. Es el mismo criterio que sigue el despliegue GKE en
`desplegar.sh`, donde los workspaces `alone` van solo al cluster de índice `0`. Si el
entorno no tiene ningún cluster con label `zona`, el paso falla en lugar de generar un
despliegue hacia una zona inexistente.

La label **`cloud-run`** del proyecto de GCP, si está, fija la **región** de los
workspaces `alone` (p. ej. `cloud-run=europe-west1`), aunque el entorno no tenga
cluster en ella. La zona es la del cluster del entorno en esa región, y si no hay
ninguno, la que habría dado el criterio de arriba: solo cambia la región. Sin `alone`,
la label no se usa.

Con `deploy.lambda.vpc = true`, la subred sale de la label `subnetwork` del proyecto.
Se busca por nombre en la región donde se despliega, así que en esa región tiene que
existir una subred con ese nombre.

---

## Flujo de versiones

- **Contenedor:** la versión viene de `<ruta>/version.txt` generado por `mrpack deploy`.
  Tags publicados: `latest`, `<VERSION>`, `<HASH>`, `<ENTORNO>`, `deployed_<ENTORNO>`.
  La imagen solo se regenera si cambia su hash (`hashServicio()` en
  [`compilar.ts`](../src/clases/workspace/compilar.ts)): `dependencies` y `optionalDependencies`
  del workspace, la configuración de `deploy.imagen`, el contenido compilado, el Dockerfile con el
  que se construye (el propio del workspace, o `deployment/std/Dockerfile` o `Dockerfile-next`) y,
  si no es solo `linux/amd64`, `deploy.arch`. Así que **cambiar un Dockerfile estándar regenera, en
  el siguiente despliegue de cada proyecto, todas las imágenes que lo usan**. Entre noviembre de 2024
  y noviembre de 2026 no lo hacía: el hash seguía apuntando a `framework/services-comun/despliegue/`,
  de donde se movieron, y una ruta que no existe no aporta nada al hash, sin error.
- **Storage (assets browser):** versión calculada como `YYYY.MM.DD-N` (incremento
  diario) comparando el `hash.txt` del output con el almacenado en GCS. Si el hash
  no cambió, no se sube nada.
- **Caché Yarn:** se identifica por `TRIGGER_NAME` y se invalida comparando el MD5
  de `.yarn/cache/.md5` con el guardado en `yarn.md5` antes del `yarn install`.

---

## Prueba local

```bash
# Requiere cloud-build-local instalado
@mr/cli/deployment/std/test.sh
```

