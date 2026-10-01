/**
 * Editor: Juan C. Martínez
 * Fecha: Tue, 29 Sep 2026 06:49:18 GMT
 * Hash: ecb3cdb6ef6765edc5cfcee5a8aaa839
 * Versión: 2026.9.29+1-juancmartinez
 * Proyecto: git@github.com:alpred/meteored-svc-newsletter.git
 */

import {CronExpressionParser} from "cron-parser";
import {describe, it} from "node:test";
import assert from "node:assert/strict";

import {normalizarPatron} from "../../../modules/send-task-system/utiles/dia-semana";

/**
 * Las próximas `n` ejecuciones de un patrón según `cron-parser`, que es quien decide cuándo sale un
 * envío. Se comparan fechas y no los valores del campo, porque dos campos con los mismos días
 * pueden disparar fechas distintas: un `*` es comodín y una lista no, y con el día del mes
 * restringido eso cambia el resultado.
 */
const fechas = (patron: string, n: number = 40): string[] => {
    const intervalo = CronExpressionParser.parse(patron, {currentDate: new Date("2030-01-01T00:00:00Z"), tz: "UTC"});
    return Array.from({length: n}, () => intervalo.next().getTime().toString());
}

describe("normalizarPatron", () => {

    it("quita el domingo repetido y los días repetidos", () => {
        assert.equal(normalizarPatron("0 7 * * 0,7"), "0 7 * * 7");
        assert.equal(normalizarPatron("0 7 * * 0,1,2,3,4,5,6,7"), "0 7 * * 1,2,3,4,5,6,7");
        assert.equal(normalizarPatron("0 7 * * 5,1,1"), "0 7 * * 1,5");
        assert.equal(normalizarPatron("0 7 * * 6-7,0"), "0 7 * * 6,7");
        assert.equal(normalizarPatron("0 7 * * 0-7"), "0 7 * * 1,2,3,4,5,6,7");
    });

    it("solo toca el último campo, también con segundos", () => {
        assert.equal(normalizarPatron("0 30 8 * * 1,1"), "0 30 8 * * 1");
        assert.equal(normalizarPatron("0 9 15 * 0,7"), "0 9 15 * 7");
    });

    it("no toca un patrón sin repetidos, aunque esté desordenado o use 0 para el domingo", () => {
        for (const patron of ["0 7 * * 1,5", "0 7 * * 5,1", "0 7 * * 0", "0 7 * * 0-6", "0 7 * * 1-7"]) {
            assert.equal(normalizarPatron(patron), patron);
        }
    });

    it("no expande el comodín: con el día del mes restringido cambiaría los días que dispara", () => {
        for (const patron of ["0 7 * * *", "0 9 15 * *", "0 9 L * *", "0 9 15 * ?", "0 9 * * *,0"]) {
            assert.equal(normalizarPatron(patron), patron);
        }
    });

    it("deja el patrón como está si el campo de día no se sabe leer", () => {
        for (const patron of ["0 7 * * */2", "0 7 * * 5L", "0 7 * * 1#2", "0 7 * * mon", "0 7 * * sun,7", "0 7 * * 8", "0 7 * * 5-1", "0 7 * * 1,,5", "0 7 *"]) {
            assert.equal(normalizarPatron(patron), patron);
        }
    });

    it("cualquier combinación de días 0-7, en orden, al revés o con un repetido, dispara las mismas fechas que la misma lista sin repetir, con el día del mes libre o restringido", () => {
        for (const diaDelMes of ["*", "15", "L"]) {
            for (let mascara = 1; mascara < 1 << 8; mascara++) {
                const dias = [0, 1, 2, 3, 4, 5, 6, 7].filter((dia) => (mascara & (1 << dia)) !== 0);
                const referencia = `0 7 ${diaDelMes} * ${[...new Set(dias.map((dia) => dia % 7))].sort((a, b) => a - b).join(",")}`;
                for (const campo of [dias.join(","), [...dias].reverse().join(","), [...dias, dias[0]].join(",")]) {
                    const patron = normalizarPatron(`0 7 ${diaDelMes} * ${campo}`);
                    assert.deepEqual(fechas(patron), fechas(referencia), `fechas distintas para ${campo} con día del mes ${diaDelMes}`);
                }
            }
        }
    });
});
