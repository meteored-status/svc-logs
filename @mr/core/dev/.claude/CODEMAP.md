# CODEMAP — `@mr/core/dev/.claude/`

> Todo el directorio se symlinkea en la raíz de cada monorepo consumidor por
> `initClaudeDir()` (`@mr/cli/src/clases/init/symlinks.ts`), igual que `initGithub()`
> hace con `.github/`.

---

## Árbol de directorios

```txt
.claude/
├── .mr-ignore                    Excluye settings.local.json del envío del framework
├── settings.json                 Declara el hook Stop -> hooks/check-codemap.mjs
│                                  y permisos (ask sobre los dos agentes caros)
├── delegacion-multimodelo.md     Política de delegación a subagentes (importada desde CLAUDE.md)
├── agents/                       Subagentes de modelo fijo usados por la delegación
│   ├── opus-planner.md           model: opus — planificación, ambigüedad, revisión final
│   ├── fable-architect.md        model: fable — revisión adversarial, fallos reincidentes
│   └── sonnet-builder.md         model: sonnet — implementación estándar, y lo mecánico
└── hooks/
    └── check-codemap.mjs    Heurística de mantenimiento CODEMAP.md/CHANGELOG.md
```

---

## Symlink de directorio completo (`initClaudeDir()`)

A diferencia de `AGENTS.md`/`CLAUDE.md` (symlinks de fichero simple vía `initSymlinkFichero()`),
`.claude/` se symlinkea entero — mismo patrón que `initGithub()` con `.github/` (junction en
Windows, symlink relativo en Unix). Esto simplifica las rutas: el hook referencia
`.claude/hooks/...` en vez de `@mr/core/dev/.claude/hooks/...`.

`.claude/settings.local.json` es local por desarrollador y **no** debe viajar al framework
compartido ni comitearse en ningún monorepo consumidor. Tres mecanismos independientes lo
garantizan:
- `.claude/.mr-ignore` (contiene `settings.local.json`) excluye ese fichero del hash/envío del
  paquete framework (`mrpack framework --send`) — mismo mecanismo que ya usa
  `@mr/core/dev/.mr-ignore` para excluir `tsconfig.tsbuildinfo`, pero aquí a nivel de
  subdirectorio (`.mr-ignore` se lee de forma independiente en cada directorio durante el
  recorrido, ver `paquete/directory.ts`).
- La plantilla `IGNORE` de `@mr/cli/src/clases/init/ignore.ts` incluye
  `**/.claude/settings.local.json`, que `mrpack init` escribe en el `.gitignore` raíz de
  cada monorepo consumidor — así git nunca lo trackea, sea cual sea el path físico real
  (`@mr/core/dev/.claude/settings.local.json` a través del symlink).
- Si `{basedir}/.claude` ya existía como **directorio real** (con un `settings.local.json` de
  antes de tener este framework), `initClaudeDir()` migra sus entradas a
  `@mr/core/dev/.claude/` (sin sobreescribir lo que ya hubiera) antes de sustituirlo por el
  symlink, para no perder configuración local del desarrollador.

## `settings.json`

Un único hook `Stop` (sin `matcher` — no soportado/ignorado por este evento) que invoca
`node "$CLAUDE_PROJECT_DIR/.claude/hooks/check-codemap.mjs"`. Invocar siempre vía `node`
(nunca ejecutar el `.mjs` directamente) evita depender de que el transporte GCS/zip de
`mrpack framework` preserve el bit ejecutable.

También declara un `permissions.ask` con cuatro reglas, para dar visibilidad sobre el gasto en los
dos agentes caros sin interrumpir las llamadas a `sonnet-builder`:
`Agent(subagent_type:opus-planner)` y `Agent(subagent_type:fable-architect)`, que son las que hacen
el trabajo, más `Agent(model:opus)` y `Agent(model:fable)`.

`Tool(param:valor)` casa contra **un parámetro de la llamada**, y
[un parámetro que la llamada omite no casa nunca](https://code.claude.com/docs/en/permissions#match-by-input-parameter).
Como el modelo de un subagente lo fija el `model:` de su frontmatter (ver `agents/` más abajo) y no
un parámetro de la llamada, una regla `Agent(model:…)` sola **no se dispara al despachar por
`subagent_type`** — que es como se despacha siempre. Las dos reglas de `model` se mantienen solo
para cubrir un override explícito de modelo en la llamada.

---

## `delegacion-multimodelo.md` y `agents/`

Política de delegación multi-modelo, importada desde `CLAUDE.md` raíz (`@.claude/
delegacion-multimodelo.md`). Define tres subagentes de modelo fijo en `agents/`, para repartir el
trabajo sin pedir cambios manuales de modelo:

- **`opus-planner`** (`model: opus`) — planificación de tareas complejas, ambigüedad,
  arquitectura, seguridad, debugging difícil y revisión final antes de cerrar una tarea.
- **`fable-architect`** (`model: fable`, `tools` sin `Edit`/`Write` — lee y mide, no escribe) —
  revisión adversarial y fallos que ya se resistieron a dos o más intentos de arreglo. No es un
  `opus-planner` mejor: responde a otra pregunta («¿qué estamos dando por cierto que no lo es?») y
  su prompt no debe ser prescriptivo. Es el modelo más caro del conjunto y sus turnos duran
  minutos, así que queda fuera de cualquier bucle de iteración rápida. La revisión final sigue
  siendo de `opus-planner`: este se añade encima solo si el cambio es difícil de revertir o si el
  fallo ya se resistió a varios intentos. **Fable puede no estar permitido** —lo decide la allowlist
  `availableModels` de la organización, no la licencia individual—, y entonces la llamada no da
  error: el subagente corre con el modelo heredado del hilo principal. En sesiones interactivas
  Claude Code avisa nombrando los dos modelos; por eso la política manda no invocarlo donde no esté
  permitido, en vez de dejar que conteste otro haciéndose pasar por él.
- **`sonnet-builder`** (`model: sonnet`) — implementación estándar, refactors medios, tests,
  integración; agente por defecto una vez el plan está claro, y también lo mecánico determinista
  (formateo, imports, búsqueda/reemplazo literal), que hace dentro de su propio cambio.

Hubo un cuarto, `haiku-mechanic` (`model: haiku`), solo para eso mecánico. Se quitó el 2026-09-23:
dos usos en mes y medio, un ahorro de céntimos, y el doble de coste cada vez que la tarea resultaba
no ser mecánica y había que rehacerla en `sonnet-builder`.

Cada subagente se invoca desde el hilo principal con la herramienta `Agent`; el modelo lo fija
el `model:` del frontmatter de cada `.md`, no un parámetro pasado en la llamada. Orden de
prioridad si hay conflicto: calidad del código > ausencia de errores > coste.

---

## `hooks/check-codemap.mjs`

Node ESM plano, sin dependencias externas.

### Flujo (`main()`)

1. Lee JSON de stdin. Si `stop_hook_active === true` (Claude Code ya bloqueó una vez en este
   intento de parada), retorna sin hacer nada — evita bucles infinitos.
2. `git status --porcelain=v1` en `entrada.cwd`. Si no hay salida, retorna (camino rápido).
3. `parsearStatus()` — parsea cada línea (`XY PATH`, maneja `R  old -> new` y comillado),
   descarta líneas `D` (borrados).
4. `rutaIgnorada()` — descarta rutas bajo `node_modules/`, `.yarn/`, `output/`, `files/`,
   `bin/min/`, `tmp/`, `.git/`.
4b. `expandirDirectorioNuevo()` — `git status` colapsa un directorio nuevo entero en una sola
   línea (`?? services/logs/src/`) en vez de listar cada fichero; cualquier entrada que termine
   en `/` se expande con una llamada de `git status --untracked-files=all` **acotada a ese
   pathspec** (no al repo completo, para no pagar el coste de memoria de `-uall` a nivel de
   monorepo).
5. Agrupa (`raizWorkspace()`) las rutas con extensión de código (`.ts .tsx .js .jsx .mjs .cjs`)
   por el directorio ancestro más cercano con `package.json`, **descartando el grupo que
   resuelva a la raíz del monorepo** (`basedir`).
6. Por cada workspace: "significativo" = algún fichero nuevo (`??`/`A`) o suma de líneas
   cambiadas (`git diff --numstat`) ≥ `LINEAS_UMBRAL` (15, constante ajustable al inicio del
   fichero).
7. Si es significativo: `tocadoEnArbol()` comprueba si algún `CODEMAP.md` **en cualquier
   punto del árbol del workspace** (no solo en su raíz exacta — en este monorepo los CODEMAP.md
   viven anidados por submódulo, ej. `@mr/cli/src/CODEMAP.md`) está entre los ficheros
   cambiados → si no, `missingCodemap`. `existeEnArbol()` busca recursivamente (profundidad
   máxima 6, saltando `node_modules/.yarn/output/files/bin/tmp/.git`) si existe algún
   `CHANGELOG.md` en el workspace; si existe y ninguno fue tocado → `missingChangelog`
   (CHANGELOG solo se exige si ya existía alguno).
8. Si alguna lista no está vacía, `bloquear()` imprime a stdout
   `{"hookSpecificOutput":{"hookEventName":"Stop","decision":"block","reason":"..."}}` listando
   los workspaces afectados. El propio mensaje invita a ignorar el aviso si el cambio no aplica.
9. Todo `main()` corre envuelto en un `try/catch` fail-open: cualquier error inesperado en la
   heurística no debe bloquear al agente.

### Limitaciones conocidas (documentadas también en el propio fichero y en `AGENTS.md`)

- Solo analiza cambios en working tree (no commits).
- Por el guardrail `stop_hook_active` de Claude Code, bloquea como máximo una vez por intento
  de parada — no es un bloqueo "hasta que se arregle", es el estándar anti-bucle de Claude Code.
- Heurística por líneas/ficheros nuevos, no análisis semántico: puede haber falsos
  positivos/negativos ocasionales.
