# CODEMAP — `services-comun/modules/send-task-system`

> Ver [`README.md`](./README.md) para el diagrama de flujo completo. Bloque padre:
> [`../../CODEMAP.md`](../../CODEMAP.md#6-sistema-de-envíos-modulessend-task-system).

---

## Modelo de dominio (`data/model/`)

| Fichero | Símbolos exportados | Descripción |
|---------|---------------------|--------------|
| `send-task.ts` | `SendTask`, `ISendTask`, `TSendTaskStatus` (`ACTIVE`\|`INACTIVE`), `TSendTaskType` (`NEWSLETTER`\|`LOCATION`) | Definición de una tarea de envío recurrente: ventana de validez (`start_validity`/`end_validity`), tipo y estado |
| `periodicity.ts` | `Periodicity`, `IPeriodicity` | Regla de recurrencia cron (`pattern` + `timezone`, vía `cron-parser`) asociada a una `SendTask`; `nextExecutionDate(limitDate)` calcula la siguiente ejecución tras esa fecha |
| `send-schedule.ts` | `SendSchedule` | Próxima fecha de ejecución (`sendDate`) planificada para una `SendTask` — una por tarea; se recalcula tras cada ejecución a partir de todas sus `Periodicity` |
| `pending-send-task.ts` | `PendingSendTask`, `IPendingSendTask` | Entrada en la cola de pendientes (PubSub): `id` de la `SendTask`, `type`, `schedule_at`; `complete()` invoca el callback de confirmación de procesado del broker |
| `send-task-instance.ts` | `SendTaskInstance` | Una ejecución concreta de una `SendTask` (agrupa los `Send` generados en esa pasada) |
| `send.ts` | `Send` (abstract), `ISend`, `TStatus` (`SEND`\|`PENDING`\|`ERROR`), `TSend` (`SPARKPOST`) | Envío individual concreto; `TSend` es el discriminante usado por los *builders* (`SenderBuilder`, `ReceiverIdentifierBuilder`) |
| `sparkpost-send.ts` | `SparkpostSend extends Send` | Especialización de `Send` para el proveedor SparkPost |
| `receiver.ts` | `Receiver` | Destinatario identificado de un `Send`; `Receiver.create(receiverId, sendId, sendTaskId, sendTaskInstanceId)` |
| `send-event.ts` | `SendEvent` | Evento recibido sobre un `Send` (delivery/open/click/bounce/…) |
| `sparkpost-event.ts` | `SparkpostEvent extends SendEvent` | Especialización para eventos de webhook de SparkPost (ver `modules/email/webhook/sparkpost`) |

---

## Capa de datos — DAO (`data/dao/`)

**Factoría:** `data/dao/d-a-o-factory.ts` → `IDAOFactory` (interfaz de agregación; la implementación
concreta que la construye está comentada/pendiente en el propio fichero — cada servicio consumidor
instancia sus DAOs concretos y los agrega manualmente por ahora).

| Dominio | Interfaz | Implementación(es) | Backend |
|---------|----------|---------------------|---------|
| `send/` | `SendDAO` | `ElasticSendDAO` | Elasticsearch (`sendIndex`) |
| `event/` | `EventDAO` | `ElasticEventDAO` | Elasticsearch (`eventIndex`) |
| `receiver/` | `ReceiverDAO` | `ElasticReceiverDAO` | Elasticsearch (`receiverIndex`) |
| `send-task/` | `SendTaskDAO` | `MySQLSendTaskDAO` | MySQL — incluye `scheduled(limitDate, type, pageSize)` → `Pagination<SendTask>` (ver `database/pagination`) |
| `send-task/` | `PendingSendTaskDAO` (`AbstractPendingSendTaskDAO`) | `PubSubPendingSendTaskDAO` | PubSub — `save()` publica, `listen(callback)` suscribe |
| `send-task/` | `SendScheduleDAO` | `MySQLSendScheduleDAO` | MySQL — incluye `createBulk()` (ver `database/bulk`) |
| `send-task/` | `PeriodicityDAO` | `MySQLPeriodicityDAO` | MySQL |

`PendingSendTaskDAO.listen(callback: (pendingSendTask) => void): Promise<void>` es el contrato clave del
patrón productor/consumidor: `GeneratorController` produce (`save()`), `PendingSendTaskListener` consume
(`listen()`).

---

## Generación y planificación (`controller/generator-controller.ts`)

`GeneratorController(factory, type, cronStep)` — invocado periódicamente (cron externo) por tipo de
`SendTask`:

```
GeneratorController.run(): Promise<void>
  1. limitDate = now + cronStep minutos, redondeado al fin de hora
  2. pagina factory.sendTask.scheduled(limitDate, type, 2000)
  3. por página: junta Periodicity[] y SendSchedule por sendTask
  4. filtra send-tasks sin periodicities o sin send-schedule (log de error, se omiten)
  5. factory.pendingSendTask.save(new PendingSendTask(...)) por cada send-task válida
  6. recalcula SendSchedule.sendDate = min(periodicities.nextExecutionDate(limitDate)) y bulk-update
  7. borra send-schedules duplicados detectados
  8. reintenta encolados fallidos hasta MAX_TRIES=3, con 5s de espera entre intentos
```

---

## Consumo y envío (`listener/`, `controller/send-task-controller.ts`, `sender/`, `receiver/`)

#### `PendingSendTaskListener` (`listener/pending-send-task-listener.ts`)

Singleton (`PendingSendTaskListener.listen(factory, controllerBuilder)`). Se suscribe a
`factory.pendingSendTask.listen(...)`; por cada `PendingSendTask` recibido construye un
`SendTaskController` vía el `ControllerBuilder` inyectado, ejecuta `.run()` y llama a
`pendingSendTask.complete()` al terminar (ack al broker).

#### `SendTaskController` (abstract, `controller/send-task-controller.ts`)

```
SendTaskController
  run()
    1. sendTaskInstance = SendTaskInstance.create(sendTask.id)
    2. sends = await buildSends()                    (abstract — por proveedor/tipo de tarea)
    3. por cada send: runSend(send) en paralelo
    4. onSend()                                        (abstract — hook post-envío)

  private runSend(send)
    1. sender = SenderBuilder.getInstance().build(send)
    2. sender.onOK  → send.status = SEND,    tries++
       sender.onKO  → send.status = PENDING, tries = 1
    3. await sender.run()
    4. factory.send.save(send)
    5. receiverIds = ReceiverIdentifierBuilder.getInstance().build(send).identify()
    6. por cada receiverId: factory.receiver.save(Receiver.create(...))
```

#### `sender/` — envío

| Fichero | Símbolos | Descripción |
|---------|----------|--------------|
| `sender/sender.ts` | `Sender<T>` (abstract) | `onOK`/`onKO` (setters de callback), `run(): Promise<T>` (abstract), envuelve un `Send` |
| `sender/sender-builder.ts` | `SenderBuilder` | Singleton *factory*: `build(send)` → `Sender` según `send.type` (switch sobre `TSend`) |
| `sender/impl/sparkpost-sender.ts` | `SparkpostSender extends Sender` | Implementación real sobre `email/managers/spark_post.ts` (`SparkPostManager`) |

#### `receiver/` — identificación de destinatarios

| Fichero | Símbolos | Descripción |
|---------|----------|--------------|
| `receiver/receiver-identifier.ts` | `ReceiverIdentifier` (abstract) | `identify(): string[]` (abstract) |
| `receiver/receiver-identifier-builder.ts` | `ReceiverIdentifierBuilder` | Singleton *factory*, análogo a `SenderBuilder` |
| `receiver/impl/sparkpost-receiver-identifier.ts` | `SparkpostReceiverIdentifier extends ReceiverIdentifier` | Extrae destinatarios de un `SparkpostSend` |

---

## Ingesta de eventos y estadísticas (`controller/`, `statistics/`)

| Fichero | Símbolos exportados | Descripción |
|---------|---------------------|--------------|
| `controller/sparkpost-event-controller.ts` | `SparkpostEventController` | Recibe el payload del webhook de SparkPost (ver `modules/email/webhook/sparkpost`), lo normaliza a `SparkpostEvent`/`SendEvent` y lo persiste vía `factory.event` |
| `controller/send-event-controller.ts` | `SendEventController` | Orquesta el procesado de un `SendEvent` ya persistido: localiza sus `Receiver` y aplica el `Calculator` correspondiente |
| `controller/send-pending-controller.ts` | `SendPendingController` | Variante de disparo manual/API sobre la cola de pendientes (fuera del ciclo `GeneratorController` → `PendingSendTaskListener`) |
| `controller/statistics-controller.ts` | `StatisticsController` | Agrega estadísticas de envíos/eventos; usa `statisticsControlFile` (ver configuración) como marca de la última ejecución |
| `statistics/calculator.ts` | `Calculator` (abstract) | `calculate(receiver: Receiver): void` (abstract) — actualiza el agregado de estadísticas de un `Receiver` a partir de `this.event: SendEvent` |
| `statistics/calculator-builder.ts` | `CalculatorBuilder` | *Factory* análoga a `SenderBuilder`/`ReceiverIdentifierBuilder` |
| `statistics/impl/sparkpost-calculator.ts` | `SparkpostCalculator extends Calculator` | Implementación para eventos SparkPost |

---

## Configuración (`utiles/config.ts`)

```
IConfiguracion extends IConfigGenerico (@mr/core-utils/config)
  elasticSearch: IElasticSearch { sendIndex, eventIndex, receiverIndex }
  pubSub:        IPubSubConfig  { topic, subscription }
  statisticsControlFile: string

DEFAULT_PUBSUB_CONFIG = { topic: "meteored-send-task", subscription: "meteored-send-task-sub" }
```

Nótese que este `utiles/config.ts` importa de **`@mr/core-utils/config`** (no `@mr/core-workload/config`,
a diferencia de `d-a-o-factory.ts` que sí usa `@mr/core-workload/config` como tipo) — ambos paquetes
exponen una jerarquía `Configuracion`/`IConfiguracion` compatible; comprobar cuál es el vigente en el
servicio consumidor concreto antes de extender esta configuración.

---

## Diagrama de dependencias

```
                    utiles/config.ts (Configuracion, PubSubConfig)
                              │
                              ▼
   data/model/*  ◄──────  data/dao/* (interfaces + impl. Elastic/MySQL/PubSub)
        │                        │
        │                        ▼
        │                 d-a-o-factory.ts (IDAOFactory)
        │                        │
        ▼                        ▼
  controller/generator-controller.ts        listener/pending-send-task-listener.ts
        │  (produce PendingSendTask)                  │  (consume PendingSendTask)
        └──────────────► PendingSendTaskDAO ◄──────────┘
                                                        │
                                                        ▼
                                          controller/send-task-controller.ts (abstract)
                                                        │
                                    ┌───────────────────┼───────────────────┐
                                    ▼                   ▼                   ▼
                          sender/ (SenderBuilder)  receiver/ (Identifier   modules/messages/pubsub/v2
                          sender/impl/sparkpost-*  Builder) impl/sparkpost-* (PubSub — cola pendientes)

                    modules/email/webhook/sparkpost ──► controller/sparkpost-event-controller.ts
                                                                    │
                                                                    ▼
                                              controller/send-event-controller.ts ──► statistics/ (Calculator)
                                                                                            │
                                                                            controller/statistics-controller.ts
```

**Dependencias externas al subsistema:** `modules/database/mysql` (persistencia de planificación),
`modules/elasticsearch` + `modules/utiles/elastic` (persistencia de envíos/eventos/receptores),
`modules/messages/pubsub/v2` (cola de pendientes y, potencialmente, Eventarc), `modules/email` (envío y
verificación de webhooks SparkPost), `database/pagination` y `database/bulk` (paginación/lote en
`GeneratorController`).
