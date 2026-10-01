/**
 * Editor: Juan C. Martínez
 * Fecha: Tue, 29 Sep 2026 06:49:18 GMT
 * Hash: 1e9541bbe1b1a8f5c8437095640038b6
 * Versión: 2026.9.29+1-juancmartinez
 * Anterior: 2026.9.23+3-bixus
 * Proyecto: git@github.com:alpred/meteored-svc-newsletter.git
 */

import moment from "moment-timezone";

import type {SendTask, TSendTaskType} from "../data/model/send-task";
import {error, info} from "../../utiles/log";
import {PendingSendTask} from "../data/model/pending-send-task";
import type {IDAOFactory} from "../data/dao/d-a-o-factory";
import type {Periodicity} from "../data/model/periodicity";
import type {SendSchedule} from "../data/model/send-schedule";
import {PromiseDelayed} from "../../utiles/promise";
import {proximasEjecuciones} from "../utiles/proxima-ejecucion";

type Retry = {
    sendTask: SendTask;
    scheduleAt: number;
}

/**
 * Resumen de una ejecución de {@link GeneratorController.run}.
 *
 * @property aplazadas - Send-tasks que no se han podido planificar (sin periodicidades, o con un
 *                       patrón que `cron-parser` no sabe leer): no se han encolado y se reintentan
 *                       en la siguiente ejecución. Mientras sea mayor que cero hay algo que corregir.
 */
export interface IResumenGeneracion {
    aplazadas: number;
}

export class GeneratorController {
    /* STATIC */
    private static readonly MAX_TRIES = 3;

    /* INSTANCE */
    public constructor(
        private readonly factory: IDAOFactory,
        private readonly type: TSendTaskType,
        private readonly cronStep: number,
    ) {
    }

    /**
     * Encola las send-tasks de su tipo cuyo envío toca antes de `limitDate` y las replanifica.
     *
     * Una send-task que no se puede planificar no para al resto: se registra con `error()`, no se
     * encola y se aplaza a la siguiente ejecución (ver `proximasEjecuciones()`). Por eso esto **no
     * rechaza** por un patrón malo: quien quiera alertar tiene que mirar `aplazadas`.
     *
     * @returns Cuántas send-tasks se han aplazado.
     */
    public async run(): Promise<IResumenGeneracion> {
        // Fecha límite de envío
        const limitDate: Date = moment().add(this.cronStep, "minute").endOf("hour").toDate();

        info(`Generando send-tasks de tipo ${this.type} con fecha límite ${limitDate.toISOString()}`);

        // Recuperamos las send-tasks a procesar
        const sendTaskPagination = await this.factory.sendTask.scheduled(limitDate, this.type, 2000);

        let scheduledSendTasks;

        const errorQueue: Retry[] = [];
        let aplazadas = 0;

        while (scheduledSendTasks = await sendTaskPagination.next()) {
            info(`Procesando página ${sendTaskPagination.page - 1} (${scheduledSendTasks.length} send-tasks)`);

            // Obtenemos las periodicities y los send-schedules asociados a las send-tasks
            const [periodicities, sendSchedules] = await Promise.all([
                this.factory.periodicity.selectBySendTask(scheduledSendTasks.map(st => st.id!)),
                this.factory.sendSchedule.selectBySendTask(scheduledSendTasks.map(st => st.id!))
            ]);

            // Indexamos las periodicities y send-schedules por send-task
            const periodicitiesBySendTask: Record<number, Periodicity[]> = {};
            periodicities.forEach(periodicity => {
                if (!periodicitiesBySendTask[periodicity.sendTaskId]) {
                    periodicitiesBySendTask[periodicity.sendTaskId] = [];
                }
                periodicitiesBySendTask[periodicity.sendTaskId].push(periodicity);
            });

            const sendSchedulesToDelete: SendSchedule[] = [];
            const sendSchedulesBySendTask: Record<number, SendSchedule> = {};
            sendSchedules.forEach(schedule => {
                if (sendSchedulesBySendTask[schedule.sendTask]) {
                    error(`La send-task ${schedule.sendTask} tiene más de un send-schedule asociado. Se usará el primero.`);
                    sendSchedulesToDelete.push(schedule);
                } else {
                    sendSchedulesBySendTask[schedule.sendTask] = schedule;
                }
            });

            // Filtramos las send-tasks que no tienen send-schedule asociada (las que no tienen
            // periodicities las aplaza proximasEjecuciones(), más abajo)
            scheduledSendTasks = scheduledSendTasks.filter(sendTask => {
                const hasSendSchedule = !!sendSchedulesBySendTask[sendTask.id!];
                if (!hasSendSchedule) {
                    error(`La send-task ${sendTask.id} no tiene send-schedule asociada. Se omite su procesamiento.`);
                }
                return hasSendSchedule;
            });

            // Planificamos ANTES de encolar. Las que no se pueden planificar no se encolan, pero sí se
            // aplazan a la siguiente ejecución: si se quedaran como estaban, scheduled() las volvería a
            // devolver en cada página y este bucle no terminaría nunca.
            const {fechas: nextDateBySendTask, validas, fallidas} = proximasEjecuciones(scheduledSendTasks, periodicitiesBySendTask, limitDate);
            fallidas.forEach(({sendTask, periodicities, error: err}) => {
                error(`La send-task ${sendTask.id} no se puede planificar (${periodicities.map(p => p.pattern).join(" | ") || "sin periodicities"}). Se aplaza a la siguiente ejecución sin encolarla.`, err);
            });
            if (fallidas.length > 0) {
                error(`Página ${sendTaskPagination.page - 1}: ${fallidas.length} send-tasks aplazadas por no poder planificarlas`);
            }
            aplazadas += fallidas.length;

            const okQueue: SendTask[] = [];

            // Crear envíos pendientes
            await Promise.all(validas.map(async sendTask => {
                const scheduleAt = sendSchedulesBySendTask[sendTask.id!].sendDate.getTime()||Date.now();
                await this.factory.pendingSendTask.save(new PendingSendTask({
                    id: sendTask.id!,
                    type: sendTask.type,
                    schedule_at: scheduleAt,
                })).then(() => {
                    okQueue.push(sendTask);
                }).catch(err => {
                    error(err);
                    errorQueue.push({
                        sendTask,
                        scheduleAt
                    });
                })
            }));

            info(`Send-tasks procesadas correctamente: ${okQueue.length}`);

            // Replanificar todas las send-tasks de la página: las válidas a su próxima ejecución y las
            // fallidas al aplazamiento
            const bulkSchedules = await this.factory.sendSchedule.createBulk();
            scheduledSendTasks.forEach(sendTask => {
                const schedule: SendSchedule = sendSchedulesBySendTask[sendTask.id!];
                schedule.sendDate = nextDateBySendTask[sendTask.id!];
                bulkSchedules.update(schedule);
            });

            await bulkSchedules.run().catch(err => {
                error(`Error al guardar las replanificaciones de send-tasks en la página ${sendTaskPagination.page - 1}:`, err);
            });

            // Eliminar send-schedules duplicados
            if (sendSchedulesToDelete.length > 0) {
                info(`Eliminando ${sendSchedulesToDelete.length} send-schedules duplicados`);
                await this.factory.sendSchedule.deleteById(sendSchedulesToDelete.map(s => s.id!)).catch(err => {
                    error(`Error al eliminar send-schedules duplicados:`, err);
                });
            }
        }

        // Reintentar envíos fallidos
        if (errorQueue.length > 0) {
            info(`Procesando cola de send-tasks fallidas (${errorQueue.length} send-tasks)`);
            await this.processErrorQueue(errorQueue).catch(err => {
                error(`Error al procesar la cola de send-tasks fallidas:`, err);
            });
        }

        return {aplazadas};
    }

    private async processErrorQueue(errorQueue: Retry[], tries: number = 1): Promise<void> {
        info(`Reintentando envío de ${errorQueue.length} send-tasks fallidas (intento ${tries})`);
        const newErrorQueue: Retry[] = [];

        await Promise.all(errorQueue.map(async retry => {
            const {sendTask, scheduleAt} = retry;
            await this.factory.pendingSendTask.save(new PendingSendTask({
                id: sendTask.id!,
                type: sendTask.type,
                schedule_at: scheduleAt,
            })).catch(() => {
                newErrorQueue.push(retry);
            })
        }));

        if (newErrorQueue.length > 0 && tries < GeneratorController.MAX_TRIES) {
            info(`Reintentando envío de ${newErrorQueue.length} send-tasks fallidas (intento ${tries + 1})`);
            await PromiseDelayed(5000); // Esperamos 5 segundos antes de reintentar
            await this.processErrorQueue(newErrorQueue, tries + 1);
        } else if (newErrorQueue.length > 0) {
            info(`No se ha podido procesar ${newErrorQueue.length} send-tasks después de ${GeneratorController.MAX_TRIES} intentos`);
        }
    }
}
