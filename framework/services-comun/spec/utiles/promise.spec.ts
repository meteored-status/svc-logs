/**
 * Editor: Juan C. Martínez
 * Fecha: Tue, 20 Oct 2026 13:12:58 GMT
 * Hash: bf530778df36fccb0bb428690ecf4523
 * Versión: 2026.10.20+4-juancmartinez
 * Proyecto: git@github.com:alpred/meteored-svc-api.git
 */

import {describe, it} from "node:test";
import {setTimeout as esperar} from "node:timers/promises";
import assert from "node:assert/strict";

import {PromiseTimeout, PromiseTimeoutError, Semaforo} from "../../modules/utiles/promise";

/**
 * Timeout «largo» para las pruebas de timers vivos: de sobra para que no venza durante la prueba, y lo bastante corto para que, si un timer se
 * quedara vivo, el proceso de pruebas termine en unos segundos (y la prueba falle) en vez de quedarse esperando minutos.
 */
const LARGO_MS = 5_000;

/**
 * Temporizadores (`setTimeout`/`setInterval`) que mantienen vivo el proceso en este momento.
 */
const temporizadoresVivos = (): number => {
    return process.getActiveResourcesInfo().filter(recurso => recurso === "Timeout").length;
};

describe("Semaforo", () => {

    it("nunca hay más tareas a la vez que el máximo, y todas terminan", async () => {
        const semaforo = new Semaforo(2);
        let activas = 0;
        let pico = 0;

        const tarea = async (n: number): Promise<number> => {
            activas++;
            pico = Math.max(pico, activas);
            await esperar(10);
            activas--;
            return n;
        };

        const resultados = await Promise.all(Array.from({length: 7}, (_, i) => semaforo.run(() => tarea(i))));

        assert.deepEqual(resultados, [0, 1, 2, 3, 4, 5, 6]);
        assert.equal(pico, 2);
    });

    it("aprovecha todos los carriles: no serializa", async () => {
        const semaforo = new Semaforo(2);
        const inicio = Date.now();

        await Promise.all([semaforo.run(() => esperar(60)), semaforo.run(() => esperar(60))]);

        assert.ok(Date.now() - inicio < 110, "las dos tareas deberían solaparse");
    });

    it("las tareas esperan por orden de llegada", async () => {
        const semaforo = new Semaforo(1);
        const orden: number[] = [];

        await Promise.all([1, 2, 3, 4].map(n => semaforo.run(async () => {
            await esperar(5);
            orden.push(n);
        })));

        assert.deepEqual(orden, [1, 2, 3, 4]);
    });

    it("una tarea que falla libera su carril y rechaza solo a su llamador", async () => {
        const semaforo = new Semaforo(1);

        const mala = semaforo.run(async () => { throw new Error("fallo"); });
        const buena = semaforo.run(async () => "ok");

        await assert.rejects(mala, /fallo/);
        assert.equal(await buena, "ok");
    });

    it("una tarea que lanza de forma síncrona se propaga como rechazo y tampoco bloquea el semáforo", async () => {
        const semaforo = new Semaforo(1);

        await assert.rejects(semaforo.run(() => { throw new Error("síncrono"); }), /síncrono/);
        assert.equal(await semaforo.run(async () => 1), 1);
    });

    it("un máximo que no es un entero mayor o igual que 1 lanza RangeError", () => {
        for (const invalido of [0, -1, 1.5, 2.9, NaN, Infinity, -Infinity]) {
            assert.throws(() => new Semaforo(invalido), RangeError, `maximo=${invalido}`);
        }
    });

    it("el máximo mínimo (1) y uno grande son válidos", () => {
        assert.doesNotThrow(() => new Semaforo(1));
        assert.doesNotThrow(() => new Semaforo(1000));
    });
});

describe("PromiseTimeout", () => {

    it("devuelve el resultado si llega a tiempo", async () => {
        assert.equal(await PromiseTimeout(esperar(5).then(() => "ok"), 200), "ok");
    });

    it("rechaza con PromiseTimeoutError si tarda más, y el error lleva los ms", async () => {
        await assert.rejects(PromiseTimeout(esperar(200), 20), (err: unknown) => {
            assert.ok(err instanceof PromiseTimeoutError);
            assert.equal(err.ms, 20);
            assert.equal(err.name, "PromiseTimeoutError");
            return true;
        });
    });

    it("propaga el fallo de la operación", async () => {
        await assert.rejects(PromiseTimeout(Promise.reject(new Error("fallo")), 200), /fallo/);
    });

    it("cancela su temporizador cuando la operación termina antes: no deja timers vivos", async () => {
        const antes = temporizadoresVivos();

        // Con un timeout muy superior a lo que dura la prueba: si el timer siguiera vivo, mantendría el proceso esperando hasta que venciera
        await PromiseTimeout(Promise.resolve("ok"), LARGO_MS);

        assert.equal(temporizadoresVivos(), antes);
    });

    it("cancela su temporizador también cuando la operación falla", async () => {
        const antes = temporizadoresVivos();

        await assert.rejects(PromiseTimeout(Promise.reject(new Error("fallo")), LARGO_MS), /fallo/);

        assert.equal(temporizadoresVivos(), antes);
    });

    it("si vence primero, el rechazo posterior de la operación no queda sin atender", async () => {
        const sinAtender: unknown[] = [];
        const escuchar = (motivo: unknown): void => { sinAtender.push(motivo); };
        process.on("unhandledRejection", escuchar);

        try {
            const tardia = esperar(40).then(() => { throw new Error("tarde"); });
            await assert.rejects(PromiseTimeout(tardia, 5), PromiseTimeoutError);
            await esperar(100);
        } finally {
            process.off("unhandledRejection", escuchar);
        }

        assert.deepEqual(sinAtender, []);
    });
});
