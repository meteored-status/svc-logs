/**
 * Editor: Bixus
 * Fecha: Wed, 18 Nov 2026 15:20:23 GMT
 * Hash: ccaf541e522c3b52a8e2cca2ea6ce86d
 * Versión: 2026.11.18+1-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

import "./helpers";

import {describe, it} from "node:test";
import assert from "node:assert/strict";

import {
    ESPERA_CIERRE_MS,
    LIVENESS_JITTER_MS,
    MARGEN_APAGADO_MS,
    MAX_LIVENESS_MS,
    UMBRAL_ESCALONADO,
    VENTANA_MAX_MS,
    retrasosApagado,
    ventanaApagadoMs,
    vidaConexionMs,
} from "../server/websocket/escalonado";

/**
 * Reparto del `Shutdown` del apagado y jitter de vida de las conexiones del servidor WebSocket.
 *
 * Son cuentas cuyo error no rompe nada a la vista: una ventana a 0 o una vida sin jitter siguen funcionando y
 * solo se notan en producción, con cientos de clientes reconectando a la vez contra una réplica.
 */

describe("ventanaApagadoMs", () => {
    it("es 0 por debajo del umbral, aunque haya tiempo de sobra", () => {
        assert.equal(ventanaApagadoMs({clientes: 0, timeoutMs: 18_000}), 0);
        assert.equal(ventanaApagadoMs({clientes: UMBRAL_ESCALONADO - 1, timeoutMs: 18_000}), 0);
    });

    it("es proporcional al número de clientes (40 por segundo)", () => {
        assert.equal(ventanaApagadoMs({clientes: 100, timeoutMs: 18_000}), 2500);
        assert.equal(ventanaApagadoMs({clientes: UMBRAL_ESCALONADO, timeoutMs: 18_000}), 1250);
    });

    it("no pasa de la ventana máxima", () => {
        assert.equal(ventanaApagadoMs({clientes: 500, timeoutMs: 18_000}), VENTANA_MAX_MS);
        assert.equal(ventanaApagadoMs({clientes: 100_000, timeoutMs: 18_000}), VENTANA_MAX_MS);
    });

    it("deja sitio al cierre del último cliente dentro de timeoutMs", () => {
        for (const timeoutMs of [8000, 12_000, 18_000, 30_000]) {
            const ventana = ventanaApagadoMs({clientes: 10_000, timeoutMs});
            assert.ok(ventana + ESPERA_CIERRE_MS + MARGEN_APAGADO_MS <= Math.max(timeoutMs, ESPERA_CIERRE_MS + MARGEN_APAGADO_MS), `${timeoutMs}: ${ventana}`);
        }
        assert.equal(ventanaApagadoMs({clientes: 10_000, timeoutMs: 8000}), 2000);
        assert.equal(ventanaApagadoMs({clientes: 10_000, timeoutMs: 18_000}), VENTANA_MAX_MS);
    });

    it("en Cloud Run no escalona, aunque haya clientes de sobra y el timeout de producción", () => {
        assert.equal(ventanaApagadoMs({clientes: 500, timeoutMs: 18_000, cloudRun: true}), 0);
        assert.equal(ventanaApagadoMs({clientes: 500, timeoutMs: 18_000, cloudRun: false}), VENTANA_MAX_MS);
    });

    it("con un timeoutMs corto (desarrollo, pruebas) no escalona, y nunca es negativa", () => {
        for (const timeoutMs of [2000, 500, 0, -1]) {
            assert.equal(ventanaApagadoMs({clientes: 500, timeoutMs}), 0);
        }
    });
});

describe("retrasosApagado", () => {
    it("da un retraso por cliente, todos en [0, ventana), equiespaciados", () => {
        const retrasos = retrasosApagado({clientes: 100, ventanaMs: 2500, aleatorio: () => 0});
        assert.equal(retrasos.length, 100);
        const ordenados = [...retrasos].sort((a, b) => a - b);
        assert.deepEqual(ordenados, Array.from({length: 100}, (_, i) => Math.floor(i * 2500 / 100)));
        assert.ok(ordenados.every(r => r >= 0 && r < 2500));
    });

    it("baraja según el azar inyectado, sin perder ni repetir ningún retraso", () => {
        const sinBarajar = retrasosApagado({clientes: 60, ventanaMs: 1500, aleatorio: () => 0.9999});
        assert.deepEqual(sinBarajar, Array.from({length: 60}, (_, i) => Math.floor(i * 1500 / 60)), "con azar máximo cada uno se queda en su sitio");

        let semilla = 7;
        const aleatorio = (): number => {
            semilla = (semilla * 16807) % 2147483647;
            return semilla / 2147483647;
        };
        const barajado = retrasosApagado({clientes: 60, ventanaMs: 1500, aleatorio});
        assert.notDeepEqual(barajado, sinBarajar);
        assert.deepEqual([...barajado].sort((a, b) => a - b), [...sinBarajar].sort((a, b) => a - b));
    });

    it("con ventana 0 todos a la vez", () => {
        assert.deepEqual(retrasosApagado({clientes: 3, ventanaMs: 0, aleatorio: Math.random}), [0, 0, 0]);
    });
});

describe("vidaConexionMs", () => {
    it("va de 420 a 540 s, solo hacia abajo", () => {
        assert.equal(vidaConexionMs(() => 0), MAX_LIVENESS_MS);
        const minima = vidaConexionMs(() => 0.999);
        assert.ok(minima >= MAX_LIVENESS_MS - LIVENESS_JITTER_MS && minima < MAX_LIVENESS_MS - LIVENESS_JITTER_MS + 1000, String(minima));
        assert.equal(MAX_LIVENESS_MS, 540_000);
        assert.equal(LIVENESS_JITTER_MS, 120_000);
    });

    it("reparte una cohorte: distintos azares dan vidas distintas", () => {
        const vidas = new Set([0, 0.25, 0.5, 0.75].map(x => vidaConexionMs(() => x)));
        assert.equal(vidas.size, 4);
    });
});
