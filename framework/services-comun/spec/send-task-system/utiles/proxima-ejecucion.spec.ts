/**
 * Editor: Juan C. Martínez
 * Fecha: Tue, 29 Sep 2026 06:49:18 GMT
 * Hash: f70f17080edf70d0c1886bf7311cb054
 * Versión: 2026.9.29+1-juancmartinez
 * Proyecto: git@github.com:alpred/meteored-svc-newsletter.git
 */

import {describe, it} from "node:test";
import assert from "node:assert/strict";

import {Periodicity} from "../../../modules/send-task-system/data/model/periodicity";
import {SendTask, TSendTaskStatus, TSendTaskType} from "../../../modules/send-task-system/data/model/send-task";
import {proximasEjecuciones} from "../../../modules/send-task-system/utiles/proxima-ejecucion";

const HORA = 3600 * 1000;

/**
 * Un lunes a las 12:00 UTC, al menos una semana por delante de hoy: la próxima ejecución de
 * `0 7 * * *` es el martes siguiente a las 07:00 UTC, 19 horas después.
 *
 * Tiene que ser **futuro**: `Periodicity.nextExecutionDate()` cuenta desde ahora y avanza hasta
 * pasar el límite, así que con un límite pasado el resultado dependería del día en que se ejecuta
 * la prueba. Por eso se calcula en vez de fijarse.
 */
const LIMITE = ((): Date => {
    const fecha = new Date(Date.now() + 7 * 24 * HORA);
    fecha.setUTCDate(fecha.getUTCDate() + (8 - fecha.getUTCDay()) % 7);
    fecha.setUTCHours(12, 0, 0, 0);
    return fecha;
})();

/**
 * Prepara un lote con una send-task por entrada de `patrones` y una periodicidad por patrón, en UTC.
 */
const lote = (patrones: Record<number, string[]>): [SendTask[], Record<number, Periodicity[]>] => {
    const ids = Object.keys(patrones).map(Number);
    const sendTasks = ids.map((id) => new SendTask({id, status: TSendTaskStatus.ACTIVE, start_validity: new Date(0), type: TSendTaskType.NEWSLETTER}));
    const periodicities: Record<number, Periodicity[]> = {};
    for (const id of ids) {
        periodicities[id] = patrones[id].map((pattern) => new Periodicity({pattern, timezone: "UTC", send_task_id: id}));
    }
    return [sendTasks, periodicities];
}

describe("proximasEjecuciones", () => {

    it("el límite de las pruebas es un lunes a las 12:00 UTC", () => {
        assert.equal(LIMITE.getUTCDay(), 1);
        assert.equal(LIMITE.getUTCHours(), 12);
    });

    it("una periodicidad que no se puede calcular no afecta a las demás send-tasks", () => {
        const {validas, fallidas} = proximasEjecuciones(...lote({1: ["0 7 * * 1,5"], 2: ["0 7 * * 9"], 3: ["0 7 * * 3,7"]}), LIMITE);

        assert.deepEqual(validas.map((sendTask) => sendTask.id), [1, 3]);
        assert.deepEqual(fallidas.map(({sendTask}) => sendTask.id), [2]);
        assert.deepEqual(fallidas[0].periodicities.map(({pattern}) => pattern), ["0 7 * * 9"]);
    });

    it("las que no se pueden planificar se aplazan justo después del límite, para que salgan del lote", () => {
        const {fechas} = proximasEjecuciones(...lote({1: ["0 7 * * 9"], 2: []}), LIMITE);

        assert.equal(fechas[1].getTime(), LIMITE.getTime() + 1);
        assert.equal(fechas[2].getTime(), LIMITE.getTime() + 1);
    });

    it("todas las send-tasks del lote salen con fecha posterior al límite, las válidas y las fallidas", () => {
        const [sendTasks, periodicities] = lote({1: ["0 7 * * 1,5"], 2: ["0 7 * * 9"], 3: [], 4: ["0 7 * * 0,7"]});
        const {fechas} = proximasEjecuciones(sendTasks, periodicities, LIMITE);

        for (const sendTask of sendTasks) {
            assert.ok(fechas[sendTask.id!] > LIMITE, `la send-task ${sendTask.id} se queda en el lote`);
        }
    });

    it("una send-task sin periodicities va a fallidas", () => {
        const {validas, fallidas} = proximasEjecuciones(...lote({1: []}), LIMITE);

        assert.deepEqual(validas, []);
        assert.deepEqual(fallidas.map(({sendTask}) => sendTask.id), [1]);
    });

    it("una send-task con una periodicidad buena y otra que no se puede calcular va entera a fallidas", () => {
        const {validas, fallidas} = proximasEjecuciones(...lote({1: ["0 7 * * 1,5", "0 7 * * 9"]}), LIMITE);

        assert.deepEqual(validas, []);
        assert.deepEqual(fallidas.map(({sendTask}) => sendTask.id), [1]);
    });

    it("el domingo repetido (0 y 7) ya no rompe el cálculo", () => {
        const {fechas, fallidas} = proximasEjecuciones(...lote({1: ["0 7 * * 0,1,2,3,4,5,6,7"]}), LIMITE);

        assert.deepEqual(fallidas, []);
        assert.equal(fechas[1].getTime(), LIMITE.getTime() + 19 * HORA);
    });

    it("elige la más temprana de las próximas ejecuciones de sus periodicidades", () => {
        const {fechas} = proximasEjecuciones(...lote({1: ["0 7 * * 5", "0 7 * * 3", "0 7 * * 4"]}), LIMITE);

        assert.equal(fechas[1].getTime(), LIMITE.getTime() + 43 * HORA);
    });
});
