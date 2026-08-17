# Control de versiones (SVC)

Convenciones de ramas, commits, versionado y despliegue observadas y en uso en este
monorepo. Complementa a [`AGENTS.md`](./AGENTS.md) (convenciones de código) y a
[`.github/copilot-instructions.md`](./.github/copilot-instructions.md) (estilo y reglas
de framework).

---

## Ramas

| Rama | Rol |
|------|-----|
| `master` / `main` | Rama principal/estable. El nombre exacto depende del proyecto (en este repo es `master`). Un push aquí dispara el despliegue a **producción** (ver [Despliegue](#despliegue)). |
| `develop` | Rama de integración. Recibe merges directos de ramas `feature/*` y, periódicamente, cambios de `master`. Un push aquí dispara el despliegue a **test**. |
| `hotfix/<nombre>` | Rama de trabajo **personal** de cada desarrollador (p. ej. `hotfix/jose`, `hotfix/pedro`), empujada a `origin`. Se usa como rama larga individual para cambios rápidos o en curso; se integra directamente en `master`. |
| `feature/<YYYYMMDD>_<Nombre>[_<TICKET>]_<Descripcion>` | Rama de feature con alcance mayor, fechada y opcionalmente ligada a un ticket (p. ej. `feature/20260714_Fernando_WEB-2079_ServirAdstxt`), empujada a `origin`. Se integra en `develop`. |
| `version/<desarrollador>` | Rama de **versionado/release**, efímera y **local**: nunca se empuja a `origin`. Se crea para promover el contenido acumulado en `develop` a `master`. |

> El nombre `hotfix/<nombre>` no sigue la semántica clásica de git-flow (parche urgente
> sobre producción): aquí es la rama de trabajo habitual de cada persona. No crear una
> rama `hotfix/*` nueva por tarea — cada desarrollador mantiene la suya.

### Flujo de integración

```text
feature/<fecha>_<nombre>_<ticket>_<desc> ──cierra en──> develop

develop ──cierra en──> version/<desarrollador>
                                │
                                ├──cierra en──> master
                                └──cierra en──> develop
                                    (version/<desarrollador> se borra al cerrarse, sin push)

hotfix/<nombre> ──cierra en──> master

master ──(merge periódico)──> develop
```

- `feature/*` se cierra en `develop`: ahí se acumulan los cambios de mayor alcance,
  ligados a un ticket o que varias personas necesitan seguir.
- `develop` se cierra en una rama `version/<desarrollador>`, creada localmente cuando se
  quiere promover lo acumulado en `develop` hacia `master`.
- `version/<desarrollador>` se cierra en `master` **y** en `develop` (para que `develop`
  quede sincronizada con lo que acaba de entrar en `master`), y se borra **sin llegar a
  hacer push** — esta rama no debe existir nunca en el remoto.
- El trabajo individual rápido vive en `hotfix/<nombre>` y se cierra directamente en
  `master`, sin pasar por `develop`.
- `master` se resincroniza en `develop` también mediante merges periódicos
  (`Merge branch 'master' into develop`), para cubrir los cambios que llegan a `master`
  por otras vías (p. ej. `hotfix/*`); no se hace *rebase* de historial compartido.

### Mensajes de commit

Sin formato estricto tipo *conventional commits*. Mensajes cortos, en español, en
imperativo o descriptivos del cambio (`Update de librerías`, `Refactor`,
`Unificados proyectos`, `Símbolos Asistente + Manejador para su tratamiento`). Evitar
mensajes vacíos de contenido (`Prueba`, `pruebas`, `Nah`) salvo en ramas personales
que luego se aplastan o se limpian antes de mergear a `master`.

---

## Versionado

### Paquetes de negocio (`services/*`, `cronjobs/*`, `jobs/*`)

El campo `version` de su `package.json` no se mantiene a mano (placeholder tipo
`0000.00.00-000`): el versionado real se gestiona de forma automática durante el
proceso de despliegue (CI/CD), según haya o no cambios en cada workspace respecto al
despliegue anterior. El historial legible de cambios vive en el `CHANGELOG.md` de cada
workspace.

### Paquetes de framework (`@mr/cli`, `@mr/core-*`, `@mr/user-*`, `services-comun*`)

Al enviarse con `yarn mrpack framework --send` (ver
[`.github/copilot-instructions.md`](./.github/copilot-instructions.md#frameworks-del-monorepo)),
cada fichero recibe una cabecera autogenerada:

```ts
/**
 * Editor: <nombre completo del autor>
 * Fecha: <fecha RFC 2822 del envío>
 * Hash: <hash de contenido>
 * Versión: <YYYY.M.D>[+N]-<usuario>
 */
```

`N` es un contador que solo aparece cuando ya existe otro envío el mismo día; `usuario`
es el nombre de git normalizado (minúsculas, sin espacios). No editar esta cabecera a
mano: la regenera la herramienta en cada envío.

### `CHANGELOG.md`

Formato [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Entradas nuevas
arriba, con fecha de calendario y autor:

```markdown
## 2026.8.5 — [Jose]

### Added
- ...

### Changed
- ...
```

Usar las secciones estándar (`Added`, `Changed`, `Fixed`, `Removed`, …) solo cuando
apliquen; no es obligatorio incluir todas en cada entrada.

---

## Despliegue

Disparado automáticamente por **push** a las ramas principales, vía **Google Cloud Build**:

| Push en | Entorno |
|---------|---------|
| `develop` | test |
| `feature/test` | test (en algunos proyectos, además de `develop`) |
| `master` / `main` | producción |

El pipeline está definido en
[`@mr/cli/deployment/std/build.yaml`](../../@mr/cli/deployment/std/build.yaml) y
encadena, por cada build:

1. **Descargas** — herramientas necesarias.
2. **Labels** / **Obtener Tags** — metadatos del build.
3. **Autorizar** — credenciales de despliegue.
4. **Clonar Repositorios** — con `GITTOKEN` (Secret Manager, `alpred-lectura`).
5. **Iniciar Kustomize**.
6. **Descargar/Subir Cache Dependencias** — cache de `yarn install`.
7. **Instalar Dependencias** — `yarn install --mode=skip-build`.
8. **Compilar** — genera la app y calcula el código de versión y el hash de cada
   workspace (ver [Versionado](#versionado)); solo avanzan los pasos siguientes para los
   workspaces con cambios.
9. **Subir Storage** — sube assets a Google Cloud Storage.
10. **Generar Contenedor** — build, etiqueta y sube la imagen Docker.
11. **Kustomizar** — actualiza la versión de imagen a desplegar.
12. **Desplegar** — `gke-deploy` contra el cluster GKE.
13. **Generar Documentación** — auto-doc.
14. **Desautorizar** — revoca las credenciales temporales.

Worker pool y timeout (`1800s`) están definidos en el propio `build.yaml`.

> `yarn mrpack deploy --env=<entorno>` (ver
> [`@mr/cli/README.md`](../../@mr/cli/README.md#deploy)) es el comando de compilación
> que usa el paso **Compilar** del pipeline; invocado a mano solo compila localmente,
> no despliega ni sustituye al push a `develop`/`master`.

---

## Mantenimiento de CODEMAP.md / CHANGELOG.md

Regla ya descrita en [`AGENTS.md`](./AGENTS.md#convenciones-no-obvias-importantes-para-agentes):
cualquier cambio significativo en un workspace debe actualizar su `CODEMAP.md` (y su
`CHANGELOG.md` si ya existía) en la misma tarea. Para Claude Code esto se refuerza con
el hook `Stop` (`.claude/hooks/check-codemap.mjs`).
