/**
 * Editor: Bixus
 * Fecha: Mon, 16 Nov 2026 12:17:13 GMT
 * Hash: 84b6a7110660f10c2910fe4d0fde3718
 * Versión: 2026.11.16+1-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

import "./stubs/instalar";

import {describe, it} from "node:test";
import assert from "node:assert/strict";

import type {IHeartbeatMetricas} from "../heartbeat/interface";
import {RegistroWorkers, esMensajeHeartbeatWorker, metricasConWorkers} from "../heartbeat/workers";

/**
 * La RSS del heartbeat de un cluster: el primario suma la de sus workers vivos. Un error aquí solo se vería en la columna
 * Memoria del panel, con un pod que parece consumir menos de lo que consume.
 */

const MB = 1024 * 1024;
const propias: IHeartbeatMetricas = {rss: 100 * MB, loopP99: 1, loopMax: 2, uptime: 10};
const listo = {estado: "listo", causaDrenado: null} as const;

describe("rss del primario más los workers", () => {
    it("suma la del primario y la de dos workers", () => {
        const registro = new RegistroWorkers();
        registro.alta(1, 1000);
        registro.alta(2, 1000);
        registro.informe(1, {...listo, rss: 200 * MB}, 2000);
        registro.informe(2, {...listo, rss: 300 * MB}, 2000);

        assert.equal(metricasConWorkers(propias, registro, 2500).rss, 600 * MB);
    });

    it("conserva el resto de las métricas", () => {
        const registro = new RegistroWorkers();
        registro.alta(1, 1000);
        registro.informe(1, {...listo, rss: 5}, 2000);

        assert.deepEqual(metricasConWorkers(propias, registro, 2000), {...propias, rss: 100 * MB + 5});
    });

    it("un worker muerto deja de sumar", () => {
        const registro = new RegistroWorkers();
        registro.alta(1, 1000);
        registro.alta(2, 1000);
        registro.informe(1, {...listo, rss: 200 * MB}, 2000);
        registro.informe(2, {...listo, rss: 300 * MB}, 2000);
        registro.baja(2);

        assert.equal(metricasConWorkers(propias, registro, 2500).rss, 300 * MB);
    });

    it("un worker que informó parado no suma", () => {
        const registro = new RegistroWorkers();
        registro.alta(1, 1000);
        registro.informe(1, {estado: "parado", causaDrenado: null, rss: 200 * MB}, 2000);

        assert.equal(metricasConWorkers(propias, registro, 2500).rss, 100 * MB);
    });

    it("un worker que lleva más de 3 s sin informar no suma con su valor viejo", () => {
        const registro = new RegistroWorkers();
        registro.alta(1, 1000);
        registro.alta(2, 1000);
        registro.informe(1, {...listo, rss: 200 * MB}, 2000);
        registro.informe(2, {...listo, rss: 300 * MB}, 5000);

        assert.equal(metricasConWorkers(propias, registro, 5500).rss, 400 * MB);
    });

    it("un worker sin rss (versión anterior) o con un rss inválido no suma y no rompe", () => {
        const registro = new RegistroWorkers();
        registro.alta(1, 1000);
        registro.alta(2, 1000);
        registro.alta(3, 1000);
        registro.alta(4, 1000);
        registro.informe(1, listo, 2000);
        registro.informe(2, {...listo, rss: Number.NaN}, 2000);
        registro.informe(3, {...listo, rss: -5}, 2000);
        registro.informe(4, {...listo, rss: 50 * MB}, 2000);

        assert.equal(metricasConWorkers(propias, registro, 2500).rss, 150 * MB);
        assert.ok(esMensajeHeartbeatWorker({cmd: "heartbeat", estado: "listo", causaDrenado: null}));
        assert.ok(esMensajeHeartbeatWorker({cmd: "heartbeat", estado: "listo", causaDrenado: null, rss: 5}));
    });

    it("un worker dado de alta que aún no ha informado no suma", () => {
        const registro = new RegistroWorkers();
        registro.alta(1, 1000);

        assert.equal(metricasConWorkers(propias, registro, 1500).rss, 100 * MB);
    });

    it("en un pod simple (sin registro) las métricas no cambian", () => {
        assert.equal(metricasConWorkers(propias, null, 2000), propias);
    });
});
