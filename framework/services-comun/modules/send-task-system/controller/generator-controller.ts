import moment from "moment-timezone";
import {SendTask, TSendTaskType} from "../data/model/send-task";
import {error, info} from "../../utiles/log";
import {PendingSendTask} from "../data/model/pending-send-task";
import {IDAOFactory} from "../data/dao/d-a-o-factory";
import {Periodicity} from "../data/model/periodicity";
import {SendSchedule} from "../data/model/send-schedule";
import {PromiseDelayed} from "../../utiles/promise";

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

    public async run(): Promise<void> {
        // Fecha límite de envío
        const limitDate: Date = moment().add(this.cronStep, "minute").endOf("hour").toDate();

        info(`Generando send-tasks de tipo ${this.type} con fecha límite ${limitDate.toISOString()}`);

        // Recuperamos las send-tasks a procesar
        const sendTaskPagination = await this.factory.sendTask.scheduled(limitDate, this.type, 2000);

        let scheduledSendTasks;

        let errorQueue: SendTask[] = [];

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

            const sendSchedulesBySendTask: Record<number, SendSchedule> = {};
            sendSchedules.forEach(schedule => {
                sendSchedulesBySendTask[schedule.sendTask] = schedule;
            });

            // Filtramos las send-tasks que no tienen periodicities o send-schedules asociadas
            scheduledSendTasks = scheduledSendTasks.filter(sendTask => {
                const hasPeriodicities = periodicitiesBySendTask[sendTask.id!] && periodicitiesBySendTask[sendTask.id!].length > 0;
                const hasSendSchedule = !!sendSchedulesBySendTask[sendTask.id!];
                if (!hasPeriodicities) {
                    error(`La send-task ${sendTask.id} no tiene periodicities asociadas. Se omite su procesamiento.`);
                }
                if (!hasSendSchedule) {
                    error(`La send-task ${sendTask.id} no tiene send-schedule asociada. Se omite su procesamiento.`);
                }
                return hasPeriodicities && hasSendSchedule;
            });

            const okQueue: SendTask[] = [];

            // Crear envíos pendientes
            await Promise.all(scheduledSendTasks.map(async sendTask => {
                await this.factory.pendingSendTask.save(new PendingSendTask({
                    id: sendTask.id!,
                    type: sendTask.type
                })).then(() => {
                    okQueue.push(sendTask);
                }).catch(err => {
                    error(err);
                    errorQueue.push(sendTask);
                })
            }));

            info(`Send-tasks procesadas correctamente: ${okQueue.length}`);

            // Replanificar las send-tasks que se han procesado correctamente
            const bulkSchedules = await this.factory.sendSchedule.createBulk();
            scheduledSendTasks.map(sendTask => {
                const periodicities: Periodicity[] = periodicitiesBySendTask[sendTask.id!];

                const nextPeriodicity: Periodicity = periodicities.reduce((previous: Periodicity, current: Periodicity) => {
                    return previous.nextExecutionDate(limitDate) < current.nextExecutionDate(limitDate) ? previous : current;
                });

                const schedule: SendSchedule = sendSchedulesBySendTask[sendTask.id!];
                schedule.sendDate = nextPeriodicity.nextExecutionDate(limitDate);
                bulkSchedules.update(schedule);
            });

            await bulkSchedules.run().catch(err => {
                error(`Error al guardar las replanificaciones de send-tasks en la página ${sendTaskPagination.page - 1}:`, err);
            });
        }

        // Reintentar envíos fallidos
        if (errorQueue.length > 0) {
            info(`Procesando cola de send-tasks fallidas (${errorQueue.length} send-tasks)`);
            await this.processErrorQueue(errorQueue).catch(err => {
                error(`Error al procesar la cola de send-tasks fallidas:`, err);
            });
        }
    }

    private async processErrorQueue(errorQueue: SendTask[], tries: number = 1): Promise<void> {
        info(`Reintentando envío de ${errorQueue.length} send-tasks fallidas (intento ${tries})`);
        let newErrorQueue: SendTask[] = [];

        await Promise.all(errorQueue.map(async sendTask => {
            await this.factory.pendingSendTask.save(new PendingSendTask({
                id: sendTask.id!,
                type: sendTask.type
            })).catch(() => {
                newErrorQueue.push(sendTask);
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
