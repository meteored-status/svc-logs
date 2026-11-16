/**
 * Editor: Bixus
 * Fecha: Fri, 13 Nov 2026 08:17:27 GMT
 * Hash: f50413c4d582acb9944f6842d664778f
 * Versión: 2026.11.13+1-bixus
 * Proyecto: https://github.com/meteored-status/svc-status.git
 */

import "./stubs/instalar";

import {describe, it} from "node:test";
import assert from "node:assert/strict";

import {avisos, limpiarAvisos} from "./stubs/log";
import {ApagadoUnico} from "../engine/apagado-unico";

/**
 * `Engine.solicitarApagado()` es el único camino al `shutdown()` del engine (watcher del lock, cierre del servidor
 * HTTP, señal): lo ejecuta una sola vez aunque se pida por varias vías y nunca rechaza.
 */

const montar = (falla = false): {apagado: ApagadoUnico; llamadas: () => number} => {
    let llamadas = 0;
    const apagado = new ApagadoUnico(async () => {
        llamadas++;
        await new Promise<void>(resolve => setTimeout(resolve, 30));
        if (falla) {
            throw new Error("boom");
        }
    });

    return {apagado, llamadas: () => llamadas};
};

describe("ApagadoUnico", () => {
    it("ejecuta la acción una sola vez aunque se pida dos veces a la vez, y las dos esperan a la misma promesa", async () => {
        const {apagado, llamadas} = montar();
        const a = apagado.solicitar();
        const b = apagado.solicitar();
        assert.equal(a, b);
        await Promise.all([a, b]);
        await apagado.solicitar();
        assert.equal(llamadas(), 1);
    });

    it("no ejecuta nada hasta que se pide", async () => {
        const {llamadas} = montar();
        assert.equal(llamadas(), 0);
    });

    it("un rechazo de la acción no se propaga: se avisa y la promesa resuelve", async () => {
        limpiarAvisos();
        const {apagado, llamadas} = montar(true);
        await apagado.solicitar();
        await apagado.solicitar();
        assert.equal(llamadas(), 1);
        assert.equal(avisos.length, 1);
    });
});
