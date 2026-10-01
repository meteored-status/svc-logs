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
    ├── aliases.sh            Extiende el PATH para los binarios de bin/
    ├── descargas.sh          Descarga herramientas (jq, yq, kustomize, cloud_sql_proxy) y resuelve flags CI/CD
    ├── labels.sh             Obtiene clusters GKE y sus namespaces para el entorno activo
    ├── tags.sh               Obtiene tags de imagen Docker existentes por workspace
    ├── autorizar.sh          Añade la IP del worker a los masters authorized networks de GKE
    ├── desautorizar.sh       Elimina la IP del worker de los masters authorized networks de GKE
    ├── clone.sh              Clona el repositorio de kustomize en la rama correcta
    ├── init_kustomize.sh     Inicializa el proyecto kustomize (llama a kustomizar/init.sh)
    ├── cache_get.sh          Descarga la caché de dependencias Yarn desde GCS
    ├── cache_set.sh          Sube la caché de dependencias Yarn a GCS si cambió
    ├── compilar.sh           Compila los workspaces (yarn mrpack deploy); arranca/para cloud_sql_proxy si hay MySQL
    ├── contenedor.sh         Construye y sube imágenes Docker con docker buildx; gestiona tags deployed/latest
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
        ├── path1             Extrae el primer segmento de una ruta (services/foo → services)
        ├── path2             Extrae el segundo segmento (services/foo → foo)
        └── path3             Extrae el tercer segmento
```

---

## Pipeline `build.yaml`

Pipeline principal de Cloud Build. Cada paso es un contenedor de GCP; los pasos
que no dependen entre sí se ejecutan en paralelo.

### Diagrama de dependencias

```
Descargas ──┬──> Labels ──────────────────┬──> Autorizar ─────────────────────┐
            │                             │                                   │
            ├──> Obtener Tags             ├──> Clonar Repositorios ──> Init   │
            │                             │    Kustomize                      │
            └──> Descargar Cache ──> Instalar Dependencias                    │
                     ┌───────────────────────────┘                            │
                     ▼                                                        │
                  Compilar ──┬──> Subir Cache                                 │
                             ├──> Subir Storage ──────────────────────────────┼──> Desplegar
                             └──> Generar Contenedor ──> Kustomizar ──────────┘
                                                                              │
                                                                              └──> Generar Documentación ──> Desautorizar
```

### Pasos del pipeline

| ID | Imagen GCP       | Script | Descripción |
|----|------------------|--------|-------------|
| `Descargas` | `curl`           | `descargas.sh` | Descarga `jq`, `yq`, `kustomize` y opcionalmente `cloud_sql_proxy`; resuelve los flags `_DESPLEGAR`, `_GENERAR`, etc. |
| `Labels` | `gcloud`         | `labels.sh` | Lista clusters GKE del entorno y obtiene sus namespaces `mrpress`. Genera `entornos.json`, `clientes.json`, `labels.json`. |
| `Obtener Tags` | `gcloud`         | `tags.sh` | Descarga los tags Docker actuales de cada workspace (para decidir si hay que generar imagen). |
| `Autorizar` | `gcloud`         | `autorizar.sh` | Añade la IP pública del worker a `masterAuthorizedNetworks` de cada cluster GKE. |
| `Clonar Repositorios` | `git`            | `clone.sh` | Clona el repo de kustomize (rama `main` en producción, `develop` en otros entornos). Requiere el secreto `GITTOKEN`. La organización es `_K8S_GITHUB` si el trigger la define, y si no, la etiqueta `k8s-github` de `labels.json`. |
| `Iniciar Kustomize` | `gcloud`         | `init_kustomize.sh` | Ejecuta `kustomizar/init.sh` para preparar la estructura de overlays. |
| `Descargar Cache Dependencias` | `gcloud`         | `cache_get.sh` | Restaura `.yarn/cache` desde GCS (`gcloud storage cp`) para acelerar `yarn install`. El bucket es `_K8S_CACHE` si el trigger la define, y si no, la etiqueta `k8s-cache` de `labels.json` (lo mismo en `cache_set.sh`). |
| `Instalar Dependencias` | `node:lts-alpine` | `yarn install --mode=skip-build` | Instala las dependencias del monorepo. |
| `Compilar` | `docker`         | `compilar.sh` | Ejecuta `yarn mrpack deploy --env=$_ENTORNO` dentro de un contenedor; arranca/para `cloud_sql_proxy` si `_MYSQL` está definido. |
| `Subir Cache Dependencias` | `gcloud`         | `cache_set.sh` | Sube `.yarn/cache` a GCS (`gcloud storage cp`/`rm`) solo si el MD5 cambió respecto a la versión cacheada. Ningún fallo de este paso tumba el build: para cuando corre, la imagen ya está subida. |
| `Subir Storage` | `gcloud`         | `storage.sh` | Sube bundles browser (assets) a GCS (`gcloud storage cat`/`cp`) con control de versión incremental (`YYYY.MM.DD-N`). |
| `Generar Contenedor` | `docker`         | `contenedor.sh` | Construye imágenes multiarch con `docker buildx` y las sube a Artifact Registry con tags `latest`, `$VERSION`, `$HASH`, `$ENTORNO` y `deployed_$ENTORNO`. Reutiliza capas entre despliegues vía `buildcache_$ENTORNO` (ver [Caché del contenedor](#caché-del-contenedor)). |
| `Kustomizar` | `gcloud`         | `kustomizar.sh` | Genera los manifiestos de despliegue para cada workspace × cluster/zona. Soporta targets `k8s` (GKE) y `lambda` (Cloud Run). |
| `Desplegar` | `gke-deploy`     | `desplegar.sh` | Aplica manifiestos GKE con `gke-deploy run` y ejecuta los scripts `lambda-*.sh` de Cloud Run. |
| `Generar Documentación` | `docker`         | `auto-doc.sh` | Ejecuta `yarn mrpack autodoc`. Solo actúa si `_MYSQL` está definido. |
| `Desautorizar` | `gcloud`         | `desautorizar.sh` | Elimina la IP del worker de `masterAuthorizedNetworks` de todos los clusters. |

### Variables de sustitución

| Variable | Descripción |
|----------|-------------|
| `_ENTORNO` | `produccion` \| `test` \| … Entorno de despliegue |
| `_CLUSTER` | Opcional (vacía por defecto). Valor de la etiqueta `entorno` con el que `labels.sh` filtra los clusters; si no está definida o está vacía, se usa `_ENTORNO`. |
| `_AUTORIZAR` | Si `false`, omite la autorización/desautorización de IPs |
| `_DESPLEGAR` | Si `false`, omite el despliegue (solo compila y genera imagen) |
| `_DESPLEGAR_LATEST` | Si `false`, no actualiza el tag `deployed_$ENTORNO` |
| `_GENERAR` | Si `false`, omite compilación e imagen de contenedor |
| `_GENERAR_FORZAR` | Si `true`, fuerza la generación aunque el hash no haya cambiado |
| `_K8S_CACHE` | Opcional (vacía por defecto). Bucket de la caché de dependencias; si está vacía, sale de la etiqueta `k8s-cache` de `labels.json`. |
| `_K8S_GITHUB` | Opcional (vacía por defecto). Organización de GitHub del repo de kustomize; si está vacía, sale de la etiqueta `k8s-github` de `labels.json`. |
| `_MYSQL` | Cadena de conexión Cloud SQL (`proyecto:region:instancia`). Si está vacía, no se arranca el proxy. |
| `_BUILD` | Nombre del worker pool de Cloud Build |
| `COMMIT_SHA` | SHA del commit (inyectado por Cloud Build) |
| `PROJECT_ID` | ID del proyecto GCP (inyectado por Cloud Build) |
| `REPO_FULL_NAME` | `org/repo` del repositorio GitHub (inyectado por Cloud Build) |
| `TRIGGER_NAME` | Nombre del trigger de Cloud Build (usado como clave de caché) |

El flag `_DESPLEGAR` puede ser forzado desde la variable o leerse del `mrpack.json`
raíz (`deploy.run.enabled`). Lo mismo aplica a `_GENERAR` (`deploy.build.enabled`)
y `_GENERAR_FORZAR` (`deploy.build.force`). Estos valores se calculan en `descargas.sh`
y se persisten en el fichero `.env`.

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

Build multi-stage. Stage `build` instala dependencias de producción con
`yarn workspaces focus --production`; stage `app` copia solo los artefactos
necesarios (`output/`, `assets/`, `app.js`). El entrypoint es `run.sh` que
ejecuta `yarn workspace <ws> node --no-warnings app.js`.

**Build args:** `BASE_IMAGE`, `RUTA`, `WS`, `DD_GIT_REPOSITORY_URL`, `DD_GIT_COMMIT_SHA`.
Los dos de Datadog los consume **solo** la stage `app`, a propósito: ver
[Caché del contenedor](#caché-del-contenedor).
**Puerto expuesto:** `8080`.

### `Dockerfile-next` — Servicios Next.js

Igual al anterior pero copia `.next/` y `public/` en lugar de `assets/` y `output/`,
incluye `next.config.js` y `next.config.deps.js`, y el entrypoint ejecuta
`yarn workspace <ws> run next start -p 8080`.

---

## Caché del contenedor

La stage `build` de los dos Dockerfiles genéricos existe para una sola cosa: resolver
las dependencias de producción del workspace. Es también la parte cara del paso
`Generar Contenedor`, así que está montada entera alrededor de poder **saltársela**.

Dos piezas, que funcionan juntas:

**1. La stage `build` no ve el código.** Copia el `package.json` del workspace y nada
más de él. Puede hacerlo porque todas las dependencias entre workspaces
(`services-comun`, `@mr/core-*`, `i18n`…) viven en `devDependencies` y
`focus --production` las ignora. Así su clave de caché depende solo de `yarn.lock` y
de ese `package.json`, no de lo que se haya tocado en el commit.

Por el mismo motivo la stage `build` **no declara** `DD_GIT_REPOSITORY_URL` ni
`DD_GIT_COMMIT_SHA`: el SHA cambia en cada commit y un `ARG` declarado ahí mete su
valor en la clave de caché de todo lo que venga detrás. Los declara la stage `app`,
que es la única que los usa.

**2. La caché vive en el registro.** `contenedor.sh` crea el builder con
`docker buildx create --driver docker-container` en cada ejecución, y ese builder
nace vacío: sin `--cache-from`/`--cache-to` no hay nada que reutilizar de un
despliegue al siguiente. La caché se guarda en la misma imagen, bajo el tag
`buildcache_<ENTORNO>` — uno por entorno, porque la imagen base puede diferir.

Dos detalles que no son cosméticos:

- `mode=max`. La capa que interesa está en una stage intermedia que no llega a la
  imagen final, y el modo por defecto solo guarda las capas publicadas.
- `image-manifest=true,oci-mediatypes=true`. Artifact Registry rechaza el formato de
  caché por defecto de buildkit.

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

### Arquitecturas, y por qué `linux/arm64` sale carísimo

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

Trece veces más, y es casi todo el paso. Descomprimir y verificar los zips es trabajo de CPU, y
emulado se paga entero.

Y no solo tarda: `bufferutil` **no compila** bajo emulación —`couldn't be built successfully
(exit code 1)`, solo en la rama arm64—. Es una `optionalDependency`, así que el build no falla y
nadie se entera: la imagen arm64 simplemente sale sin el acelerador nativo de `ws`.

Conclusión práctica: **no pidas arm64 si no hay nodos arm64.** Al lado de un 13× por emulación,
cualquier optimización de red del install es ruido. Y si hacen falta las dos de verdad, la vía es
añadir un worker arm64 real al builder (`docker buildx create --append`), no seguir emulando.

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

## Imagen en el despliegue GKE

Con los overlays `entornos/` y `clientes/`, `updateImagen()` (en `kustomizar.sh`) reescribe
la imagen que referencian los manifiestos del repo de kustomize
(`europe-west1-docker.pkg.dev/<proyecto>/<kustomize.dir>/<workspace>`) con
`kustomize edit set image <nombre>=<imagen>:<versión>`. Así apunta a la imagen que ha
subido `contenedor.sh`: `deploy.imagen.<entorno>.registro`, `.paquete` y `.nombre`, con
los mismos valores por defecto (`europe-west1-docker.pkg.dev`, `services` y el nombre del
workspace). Con el overlay `_all/`, la imagen la monta `kustomizar/build.sh`, que vive en
el repo de kustomize.

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

### Región y zona de destino

Por defecto un workspace `lambda` se despliega **una vez por cluster** del entorno:
`kustomizar.sh` recorre `entornos.json` y llama a `parseWorkspaceLambdaZona()` con
la `.zone` y la `.resourceLabels.zona` de cada uno.

Con `deploy.alone = true` en el `mrpack.json` del workspace se despliega **una sola
vez**: en la región de Bélgica (`europe-west1`) si el entorno tiene un cluster allí,
y si no, en el primero del array. Es el mismo criterio que sigue el despliegue GKE en
`desplegar.sh`, donde los workspaces `alone` van solo al cluster de índice `0`. Si el
entorno no tiene ningún cluster con label `zona`, el paso falla en lugar de generar un
despliegue hacia una zona inexistente.

---

## Flujo de versiones

- **Contenedor:** la versión viene de `<ruta>/version.txt` generado por `mrpack deploy`.
  Tags publicados: `latest`, `<VERSION>`, `<HASH>`, `<ENTORNO>`, `deployed_<ENTORNO>`.
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

