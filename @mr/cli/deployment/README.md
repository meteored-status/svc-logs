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
    ├── Dockerfile-next       Imagen genérica para servicios Next.js
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
            │                             │                                    │
            ├──> Obtener Tags             ├──> Clonar Repositorios ──> Init   │
            │                             │    Kustomize                       │
            └──> Descargar Cache ──> Instalar Dependencias                    │
                                          │                                    │
                     ┌────────────────────┘                                   │
                     ▼                                                         │
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
| `Clonar Repositorios` | `git`            | `clone.sh` | Clona el repo de kustomize (rama `main` en producción, `develop` en otros entornos). Requiere el secreto `GITTOKEN`. |
| `Iniciar Kustomize` | `gsutil`         | `init_kustomize.sh` | Ejecuta `kustomizar/init.sh` para preparar la estructura de overlays. |
| `Descargar Cache Dependencias` | `gsutil`         | `cache_get.sh` | Restaura `.yarn/cache` desde GCS para acelerar `yarn install`. |
| `Instalar Dependencias` | `node:lts-alpine` | `yarn install --mode=skip-build` | Instala las dependencias del monorepo. |
| `Compilar` | `docker`         | `compilar.sh` | Ejecuta `yarn mrpack deploy --env=$_ENTORNO` dentro de un contenedor; arranca/para `cloud_sql_proxy` si `_MYSQL` está definido. |
| `Subir Cache Dependencias` | `gsutil`         | `cache_set.sh` | Sube `.yarn/cache` a GCS solo si el MD5 cambió respecto a la versión cacheada. |
| `Subir Storage` | `gcloud`         | `storage.sh` | Sube bundles browser (assets) a GCS con control de versión incremental (`YYYY.MM.DD-N`). |
| `Generar Contenedor` | `docker`         | `contenedor.sh` | Construye imágenes multiarch con `docker buildx` y las sube a Artifact Registry con tags `latest`, `$VERSION`, `$HASH`, `$ENTORNO` y `deployed_$ENTORNO`. |
| `Kustomizar` | `gcloud`         | `kustomizar.sh` | Genera los manifiestos de despliegue para cada workspace × cluster/zona. Soporta targets `k8s` (GKE) y `lambda` (Cloud Run). |
| `Desplegar` | `gke-deploy`     | `desplegar.sh` | Aplica manifiestos GKE con `gke-deploy run` y ejecuta los scripts `lambda-*.sh` de Cloud Run. |
| `Generar Documentación` | `docker`         | `auto-doc.sh` | Ejecuta `yarn mrpack autodoc`. Solo actúa si `_MYSQL` está definido. |
| `Desautorizar` | `gcloud`         | `desautorizar.sh` | Elimina la IP del worker de `masterAuthorizedNetworks` de todos los clusters. |

### Variables de sustitución

| Variable | Descripción |
|----------|-------------|
| `_ENTORNO` | `produccion` \| `test` \| … Entorno de despliegue |
| `_AUTORIZAR` | Si `false`, omite la autorización/desautorización de IPs |
| `_DESPLEGAR` | Si `false`, omite el despliegue (solo compila y genera imagen) |
| `_DESPLEGAR_LATEST` | Si `false`, no actualiza el tag `deployed_$ENTORNO` |
| `_GENERAR` | Si `false`, omite compilación e imagen de contenedor |
| `_GENERAR_FORZAR` | Si `true`, fuerza la generación aunque el hash no haya cambiado |
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
**Puerto expuesto:** `8080`.

### `Dockerfile-next` — Servicios Next.js

Igual al anterior pero copia `.next/` y `public/` en lugar de `assets/` y `output/`,
incluye `next.config.js` y `next.config.deps.js`, y el entrypoint ejecuta
`yarn workspace <ws> run next start -p 8080`.

---

## Plantillas Cloud Run

Usadas por `kustomizar.sh` cuando el workspace tiene `deploy.target = "lambda"`:

| Fichero | Tipo | Descripción |
|---------|------|-------------|
| `cloud-run-service.yml` | `Service` (Knative) | Servicio HTTP persistente con VPC, load balancer interno + público, volumen tmpfs en `/files/tmp/` |
| `cloud-run-job.yml` | `Job` (Cloud Run v1) | Job puntual o cronjob con VPC y tmpfs; el scheduler se crea/actualiza/elimina según `deploy.schedule` y `deploy.type` |
| `cloud-run.yml` | `Service` (Knative) | Plantilla de referencia simplificada sin VPC (solo consulta) |

Los placeholders `${PROJECT_ID}`, `${KUSTOMIZER}`, `${IMAGEN}`, `${VERSION}`,
`${ENTORNO}` y `${ZONA}` son sustituidos por `kustomizar.sh` con `sed` antes de
aplicar la plantilla.

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

