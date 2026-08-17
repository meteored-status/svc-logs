# Política de delegación multi-modelo (subagentes)

Este proyecto usa tres subagentes con modelo fijo para controlar coste **sin pedir a la persona
que cambie de modelo manualmente**. Están definidos en `.claude/agents/`:

- **`opus-planner`** (Opus): planificación, arquitectura, ambigüedad, seguridad, debugging
  complejo, revisión final.
- **`sonnet-builder`** (Sonnet): implementación estándar, refactors medios, tests, integración.
- **`haiku-mechanic`** (Haiku): tareas mecánicas deterministas de riesgo nulo.

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

## Control de gasto en Opus

Para mantener visibilidad sobre el gasto en Opus sin volver a pedir cambios de modelo manuales,
puedes añadir en `.claude/settings.json` una regla de permisos que pida confirmación cada vez que
se invoque un subagente con `model: opus`:

```json
{
  "permissions": {
    "ask": ["Agent(model:opus)"]
  }
}
```

`permissions.ask` es la clave correcta en `.claude/settings.json` para reglas que piden
confirmación antes de ejecutar (a diferencia de `permissions.allow`/`permissions.deny`, que
permiten o bloquean sin preguntar). El patrón `Agent(model:opus)` filtra específicamente por el
parámetro `model` de la herramienta Agent, así que solo pedirá confirmación cuando se invoque un
subagente con `model: opus` — las llamadas a `sonnet-builder` y `haiku-mechanic` seguirán sin
interrupciones.

## Reglas generales

- No repitas preguntas de confirmación para subtareas que ya se resolvieron sin ambigüedad.
- Si `sonnet-builder` o `haiku-mechanic` reportan que una subtarea resultó ser más ambigua o
  arriesgada de lo previsto, reasígnala a `opus-planner` en vez de forzar que la terminen ellos.
- Este protocolo aplica solo a tareas no triviales; para cambios simples de una línea o preguntas
  puntuales, no es necesario activar este flujo de delegación.
