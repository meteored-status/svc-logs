# Política de delegación multi-modelo (subagentes)

Este proyecto usa tres subagentes con modelo fijo para repartir el trabajo sin pedir a la persona
que cambie de modelo manualmente. Están definidos en `.claude/agents/`:

- **`opus-planner`** (Opus): planificación, arquitectura, ambigüedad, seguridad, debugging
  complejo, revisión final.
- **`sonnet-builder`** (Sonnet): implementación estándar, refactors medios, tests, integración.
- **`fable-architect`** (Fable): revisión adversarial y fallos que ya se han resistido a varios
  intentos de arreglo. No es "un opus-planner mejor": es otra pregunta (ver más abajo).

**Orden de prioridad si hay conflicto: calidad del código > ausencia de errores > coste.** Ninguna
optimización de coste debe aplicarse si introduce duda razonable sobre corrección o calidad.

## Cómo delegar

1. **Evalúa si la tarea necesita planificación con `opus-planner`** antes de escribir código
   directamente. Delega la planificación si se cumple alguno de estos criterios:
    - Decisiones de arquitectura o diseño con varias alternativas razonables.
    - Varios módulos/archivos con dependencias no triviales entre sí.
    - Requisitos ambiguos o incompletos que requieren inferir criterios de diseño.
    - Implica seguridad, migraciones de datos, o cambios difíciles de revertir.
    - Se estima que la tarea se descompondrá en 4 o más subtareas.
    - Un error de planificación sería costoso de corregir después.

   Si ninguno se cumple, puedes planificar tú mismo (en el hilo principal, con el modelo que esté
   activo ahí) sin delegar a `opus-planner`.

2. **Despacha cada subtarea al agente indicado** usando la herramienta Agent. Agrupa en una sola
   llamada las subtareas consecutivas asignadas al mismo agente, para reducir el número de
   invocaciones.

   A diferencia de un protocolo con cambio manual de modelo, aquí **no hace falta forzar la fusión
   de bloques no consecutivos ni reordenar subtareas**: cada llamada a Agent ya usa su modelo
   automáticamente, así que no hay coste de fricción humana que ahorrar — solo el coste (menor y
   secundario) de alguna llamada extra. Respeta siempre el orden real de dependencias; no
   reordenes subtareas para ahorrar invocaciones.

3. **Nunca implementes directamente en el hilo principal** una subtarea que claramente le
   corresponde a otro agente, solo porque sea más rápido. La excepción son cambios triviales de
   una línea o preguntas puntuales, donde delegar sería sobrecoste innecesario.

4. **Cierra con una revisión final de `opus-planner`** cuando la tarea activó el criterio del
   paso 1, sin importar qué agentes ejecutaron el resto. Se invoca una sola vez, al final, no por
   cada subtarea.

## Cuándo toca `fable-architect`, que no es "opus-planner pero mejor"

Los dos se parecen en el organigrama y no se parecen en nada en la práctica, porque **responden a
preguntas distintas**:

- `opus-planner` responde **"¿cómo hacemos esto bien?"**. Es el que planifica, decide y revisa. Es
  el camino normal, y sigue siéndolo.
- `fable-architect` responde **"¿qué estamos dando por cierto que no lo es?"**. No planifica: busca
  el agujero en el modelo mental con el que se ha estado trabajando.

Llámalo cuando se cumpla alguno de estos, que son señales de que el problema no está donde se está
mirando:

- Un fallo **ya se ha intentado arreglar dos o más veces** y cada intento destapó una causa distinta.
  Es la señal más fiable de todas: significa que se está depurando contra un modelo equivocado del
  sistema, y otro intento más del mismo tipo va a destapar una cuarta cosa.
- Hace falta una **revisión adversarial** de algo que ya parece terminado. Ojo: la revisión final
  la sigue haciendo siempre `opus-planner`, y esto **no la sustituye**. `fable-architect` se añade
  encima solo cuando el cambio es caro o imposible de revertir —un despliegue, una migración de
  datos, un cambio de credenciales, o un envío de framework que se propaga a todos los monorepos
  consumidores— o cuando `opus-planner` ya ha revisado y no ha encontrado nada, pero el fallo ya
  se había resistido a dos o más intentos.
- El invariante que hay que comprobar **cruza varios workspaces** y la única forma honesta de
  comprobarlo es leerlos enteros, no razonarlo. (Si son varios módulos del mismo workspace con
  dependencias no triviales, eso es `opus-planner`.)
- Se depende del **comportamiento de una dependencia o de la infraestructura compartida**
  (`mrpack`, resolución de `tsconfig` entre workspaces, el pipeline de Cloud Build, a qué apunta
  de verdad una credencial) que nadie ha medido.

Y no lo llames para implementar (eso es `sonnet-builder`), ni como segunda opinión sobre algo que
`opus-planner` ya resolvió sin ambigüedad. Duplicar la revisión no es más calidad, es más coste y
una decisión más que arbitrar.

**Cómo se le escribe, que es la parte fácil de hacer mal.** Los prompts detallados y prescriptivos
—procedimiento paso a paso, lista de comprobación, formato de salida cerrado— son justo los que
funcionan bien con los otros agentes y le **reducen** la calidad de la respuesta a este. Dale el
problema, las evidencias que ya haya, dónde está el código y qué se ha intentado ya sin éxito; el
cómo es cosa suya. Tampoco le pidas que enseñe su razonamiento paso a paso: piensa siempre, pero no
devuelve ese razonamiento, así que pedirlo solo empeora lo que sí devuelve.

Cuesta del orden del doble que Opus por token y sus turnos duran minutos. Con la prioridad de este
proyecto (calidad > ausencia de errores > coste) eso no lo descarta, pero sí lo saca de cualquier
bucle de iteración rápida: es una llamada que se hace una vez, con la pregunta bien puesta.

### Si Fable no está permitido donde trabajas

**Fable puede no estar disponible**, y este fichero viaja a todos los monorepos consumidores, así
que habrá quien lo tenga y quien no. Quien lo decide es la
[allowlist `availableModels` de la organización](https://code.claude.com/docs/en/sub-agents#choose-a-model),
no la licencia de cada persona.

Lo que hay que saber es que **la llamada no falla**. Si el valor del frontmatter está bloqueado,
Claude Code sustituye el modelo: un alias de familia cae a la versión más nueva de esa familia que
la allowlist permita, y **cuando no permite ninguna versión de la familia** —que es el caso de
`fable` donde Fable no esté— el subagente se ejecuta con el **modelo heredado del hilo principal**.
El informe que vuelve tiene la misma forma, así que `fable-architect` no es ahí un agente caro que
no puedes pagar: es un agente que parece haber contestado y lo ha hecho otro.

**Cómo se comprueba:** en sesiones interactivas Claude Code muestra un aviso nombrando el modelo
pedido y el que realmente corre. Ese aviso es el mecanismo — no hay forma de leer la allowlist
desde dentro de la tarea, y `permissions.ask` no sirve para esto: casa por nombre de subagente, así
que confirmar no dice nada sobre qué modelo corrió. En sesiones headless la documentación no
menciona ese aviso, así que ahí no cuentes con verlo.

Si ves la sustitución —o si sabes que en tu organización Fable no está permitido—, **no lo
invoques y hazlo explícito**: manda esa revisión a `opus-planner` diciéndole que la haga en modo
adversarial —qué se da por cierto sin haberlo medido, qué se ha intentado ya sin éxito— y deja
dicho en el informe que la revisión no corrió en Fable. El prompt de `fable-architect` sigue siendo
útil como guion: las anclas de dónde suelen estar las suposiciones frágiles de este monorepo, y la
separación entre lo medido y lo inferido, valen con cualquier modelo. Lo que no vale es dar por
hecho de qué modelo viene un informe.

## Control de gasto en los modelos caros

Los dos modelos caros (Opus y Fable) piden confirmación antes de invocarse. Ya está puesto en
`.claude/settings.json`, no hay que añadirlo:

```json
{
  "permissions": {
    "ask": [
      "Agent(opus-planner)",
      "Agent(fable-architect)",
      "Agent(model:opus)",
      "Agent(model:fable)"
    ]
  }
}
```

`permissions.ask` es la clave correcta en `.claude/settings.json` para reglas que piden
confirmación antes de ejecutar (a diferencia de `permissions.allow`/`permissions.deny`, que
permiten o bloquean sin preguntar). Las reglas que hacen el trabajo son
[`Agent(<nombre-del-subagente>)`](https://code.claude.com/docs/en/permissions#agent-subagents), que
es la forma documentada de nombrar un subagente.

Las de `model` no bastan por sí solas: `Tool(param:valor)` casa contra **un parámetro de la
llamada**, no contra la configuración del subagente, y
[un parámetro que la llamada omite no casa nunca](https://code.claude.com/docs/en/permissions#match-by-input-parameter).
Como el modelo de un subagente lo fija el `model:` de su frontmatter, al despachar por nombre el
parámetro `model` no viaja y esa regla no se dispara. Se mantienen las dos para cubrir un override
explícito de modelo en la llamada. Las llamadas a `sonnet-builder` siguen sin interrupciones.

La documentación solo ilustra `Agent(<nombre>)` en `deny`; si alguna vez deja de pedir confirmación,
míralo con `/permissions` desde una sesión interactiva de `claude` en terminal, que lista las reglas
en efecto y de qué `settings.json` sale cada una. No esperes que te avise nada por tu cuenta: el
aviso de arranque solo comprueba **el nombre de la herramienta**, y `Agent` es conocida, así que una
regla que apunte a un subagente inexistente o mal escrito no salta — que es justo el fallo que
querrías cazar. Y `claude --verbose` enseña los parámetros de cada llamada.

Esto es visibilidad, no un freno: la prioridad del proyecto sigue siendo calidad > ausencia de
errores > coste, y una confirmación no es motivo para bajar a un modelo más barato una tarea que
pedía el caro.

## Reglas generales

- No repitas preguntas de confirmación para subtareas que ya se resolvieron sin ambigüedad.
- Si `sonnet-builder` reporta que una subtarea resultó ser más ambigua o arriesgada de lo previsto,
  reasígnala a `opus-planner` en vez de forzar que la termine él.
- **No hay un agente para lo mecánico.** Lo hubo (`haiku-mechanic`, en Haiku) y se quitó el
  2026-09-23: en mes y medio se usó dos veces, ahorraba céntimos, y cada vez que una tarea «mecánica»
  resultaba no serlo había que rehacerla en `sonnet-builder` y se pagaba dos veces. Un formateo o un
  renombrado literal los hace `sonnet-builder` dentro de su propio cambio, sin trocear la tarea.
- Si un mismo fallo ya se ha intentado arreglar dos o más veces y cada intento destapó una causa
  distinta, deja de reasignar a `opus-planner`: eso es exactamente la señal de `fable-architect`.
- Este protocolo aplica solo a tareas no triviales; para cambios simples de una línea o preguntas
  puntuales, no es necesario activar este flujo de delegación.
