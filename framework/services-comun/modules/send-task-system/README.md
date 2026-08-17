# `services-comun/modules/send-task-system`

Subsistema de **generación, envío, seguimiento y estadísticas de comunicaciones** (actualmente sobre
SparkPost como único proveedor de envío). Modela tareas de envío programadas y recurrentes (`SendTask`,
p. ej. newsletters), las expande en envíos individuales concretos (`Send`) a partir de una cola de
pendientes, identifica sus destinatarios (`Receiver`) y agrega eventos entrantes (aperturas, clicks,
bounces) en estadísticas.

**Código fuente:** ver [`CODEMAP.md`](./CODEMAP.md).
**Bloque padre:** [`services-comun/README.md`](../../README.md).

---

## Arquitectura

Persistencia **mixta por tipo de dato**, cada una tras su propio contrato DAO (patrón *Strategy* +
*Factory*, `IDAOFactory`):

- **MySQL** — datos de planificación: `SendTaskDAO`, `SendScheduleDAO`, `PeriodicityDAO`.
- **Elasticsearch** — datos de negocio de alto volumen: `SendDAO`, `EventDAO`, `ReceiverDAO`.
- **PubSub** — cola de trabajo: `PendingSendTaskDAO` (encola/desencola `PendingSendTask`).

```
                     ┌──────────────────┐   cron (GeneratorController.run())
                     │   SendTask (MySQL) │───────────────┐
                     │  + Periodicity      │               │  expande según Periodicity
                     │  + SendSchedule     │◄──────────────┘  y reprograma SendSchedule
                     └─────────┬──────────┘
                               │ encola
                               ▼
                     PendingSendTask (PubSub) ──► PendingSendTaskListener
                                                          │ construye vía ControllerBuilder
                                                          ▼
                                                  SendTaskController (abstract)
                                                    buildSends() → Send[]        (hook, por proveedor)
                                                    onSend()                      (hook)
                                                          │
                              ┌───────────────────────────┼───────────────────────────┐
                              ▼                           ▼                           ▼
                     SenderBuilder.build(send)  ReceiverIdentifierBuilder.build(send)  factory.send.save()
                              │                           │
                        Sender<T>.run()          ReceiverIdentifier.identify()
                     (impl. SparkpostSender)     (impl. SparkpostReceiverIdentifier)
                              │                           │
                              ▼                           ▼
                        Send (Elasticsearch)      Receiver[] (Elasticsearch)

                     Webhook SparkPost ──► SparkpostEventController ──► SendEvent (Elasticsearch)
                                                                            │
                                                                    CalculatorBuilder.build(event)
                                                                            │
                                                                    Calculator.calculate(receiver)
                                                                    (impl. SparkpostCalculator)
                                                                            │
                                                                            ▼
                                                                  StatisticsController (agregados)
```

`SenderBuilder`, `ReceiverIdentifierBuilder` y `CalculatorBuilder` son *factories* singleton que
seleccionan la implementación concreta según el discriminante `send.type`/`event` (actualmente solo
`TSend.SPARKPOST`) — añadir un nuevo proveedor de envío implica implementar `Sender`, `ReceiverIdentifier`
y `Calculator` para ese proveedor y registrar el `case` correspondiente en cada *builder*.

Ver detalle completo de ficheros y símbolos en [`CODEMAP.md`](./CODEMAP.md).

---

## Configuración

`utiles/config.ts` define `Configuracion` (extiende `Configuracion` genérica de `@mr/core-utils/config`)
con tres bloques: `elasticSearch` (índices `sendIndex`/`eventIndex`/`receiverIndex`), `pubSub`
(`topic`/`subscription`, por defecto `meteored-send-task`/`meteored-send-task-sub`) y
`statisticsControlFile` (ruta de control de la última agregación de estadísticas ejecutada).

---

## Changelog

El historial de cambios de este subsistema se registra en el `CHANGELOG.md` del workspace padre:
[`services-comun/CHANGELOG.md`](../../CHANGELOG.md).
