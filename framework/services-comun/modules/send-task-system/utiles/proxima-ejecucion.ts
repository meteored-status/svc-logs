/**
 * Editor: Juan C. Martínez
 * Fecha: Tue, 29 Sep 2026 06:49:18 GMT
 * Hash: 4f701a2d52e03b5804c88002f384cd6e
 * Versión: 2026.9.29+1-juancmartinez
 * Proyecto: git@github.com:alpred/meteored-svc-newsletter.git
 */

import type {Periodicity} from "../data/model/periodicity";
import type {SendTask} from "../data/model/send-task";

/**
 * Send-task que no se ha podido planificar.
 *
 * @property sendTask      - La send-task.
 * @property periodicities - Sus periodicidades (quizá ninguna), para poder decir en el log qué falla.
 * @property error         - Por qué: lo que lanzó el cálculo, o que no tiene periodicidades.
 */
export interface IEjecucionFallida {
    sendTask: SendTask;
    periodicities: Periodicity[];
    error: unknown;
}

/**
 * Planificación de un lote de send-tasks.
 *
 * @property fechas   - Nueva `sendDate` de **cada** send-task del lote, por id: la próxima ejecución
 *                      para las válidas y el aplazamiento para las fallidas.
 * @property validas  - Las que se han podido planificar, en el orden en que llegaron: se encolan.
 * @property fallidas - Las que no: no se encolan, solo se aplazan.
 */
export interface IProximasEjecuciones {
    fechas: Record<number, Date>;
    validas: SendTask[];
    fallidas: IEjecucionFallida[];
}

/**
 * Planifica un lote de send-tasks: la próxima ejecución de cada una es la más temprana de las de
 * sus periodicidades.
 *
 * ## Las que no se pueden planificar se aplazan, no se dejan como estaban
 *
 * Una send-task sin periodicidades, o con una que `cron-parser` no sabe leer, no hace fallar al
 * resto: va a `fallidas`, y su fecha pasa a ser **un milisegundo después de `limitDate`**. No es
 * cosmético. `SendTaskDAO.scheduled()` no pagina por offset sino que vacía un conjunto
 * (`send_date <= limitDate`, siempre desde el principio), y `GeneratorController` pide páginas
 * hasta que llega una vacía: una send-task que no saliera del conjunto volvería en cada página y
 * el bucle no terminaría nunca. Aplazada, sale del lote de esta ejecución y se reintenta en la
 * siguiente, cuyo límite es posterior.
 *
 * @param sendTasks - Send-tasks del lote.
 * @param periodicitiesBySendTask - Periodicidades de cada send-task, por id.
 * @param limitDate - Límite de esta ejecución: se busca la primera ejecución posterior a él.
 * @returns Las fechas de todas y el reparto entre válidas y fallidas.
 */
export function proximasEjecuciones(sendTasks: SendTask[], periodicitiesBySendTask: Record<number, Periodicity[]>, limitDate: Date): IProximasEjecuciones {
    const resultado: IProximasEjecuciones = {fechas: {}, validas: [], fallidas: []};
    const aplazamiento = new Date(limitDate.getTime() + 1);
    for (const sendTask of sendTasks) {
        const periodicities = periodicitiesBySendTask[sendTask.id!] ?? [];
        try {
            if (periodicities.length === 0) {
                throw new Error("No tiene periodicities asociadas");
            }
            resultado.fechas[sendTask.id!] = periodicities
                .map((periodicity) => periodicity.nextExecutionDate(limitDate))
                .reduce((previa, actual) => actual < previa ? actual : previa);
            resultado.validas.push(sendTask);
        } catch (err) {
            resultado.fechas[sendTask.id!] = aplazamiento;
            resultado.fallidas.push({sendTask, periodicities, error: err});
        }
    }
    return resultado;
}
